# ══════════════════════════════════════════════════════════════════════
# RAG API Views — all NEW endpoints under /api/rag/
# Does NOT touch processor/ or any existing endpoint.
# ══════════════════════════════════════════════════════════════════════
import json
import time
from django.http import StreamingHttpResponse, JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .rag_engine import get_engine
from .policy_store import ingest_uploaded_document


def _requested_user_email(request):
    return (request.data.get("user_email") or request.GET.get("user_email") or "").strip().lower()


def _extract_dimension_score(audit_json, dimension_name):
    """Read scores from either legacy or enterprise audit payloads."""
    audit_json = audit_json or {}
    key = (dimension_name or "").strip()
    if not key:
        return 0

    lower_key = key.lower()
    title_key = key.title()

    dimension_scores = audit_json.get("dimension_scores") or {}
    if lower_key in dimension_scores:
        value = dimension_scores.get(lower_key) or {}
        return value.get("score", 0) or 0

    metrics = audit_json.get("metrics") or {}
    if title_key in metrics:
        value = metrics.get(title_key) or {}
        return value.get("score", 0) or 0

    scores = audit_json.get("scores") or {}
    return scores.get(lower_key, 0) or 0


# ── Helper ─────────────────────────────────────────────────────────────
def _get_history_context() -> str:
    """Pull recent audit history from Neon for copilot context."""
    try:
        from processor.models import AuditResult
        recent = AuditResult.objects.all().order_by("-created_at")[:20]
        lines = []
        for r in recent:
            a = r.audit_json or {}
            lines.append(
                f"ID={r.id} | File={r.filename} | Score={r.overall_score} "
                f"| Sentiment={r.sentiment} | Performance={a.get('agent_performance','?')}"
            )
        return "\n".join(lines)
    except Exception:
        return ""


# ══════════════════════════════════════════════════════════════════════
# 1. Policy Ingest
# ══════════════════════════════════════════════════════════════════════
class PolicyIngestView(APIView):
    """POST /api/rag/ingest/  — Upload + embed a policy document into Milvus."""
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request):
        text     = request.data.get("text", "")
        doc_type = request.data.get("doc_type", "policy")
        tenant   = request.data.get("tenant_id", "default")
        file_obj = request.FILES.get("file")

        if file_obj:
            try:
                text = file_obj.read().decode("utf-8")
                filename = file_obj.name
            except Exception:
                return Response({"error": "Could not read uploaded file."}, status=400)
        else:
            filename = request.data.get("filename", "api_upload")

        if not text.strip():
            return Response({"error": "No text content provided."}, status=400)

        try:
            count = ingest_uploaded_document(text, filename, doc_type, tenant)
            return Response({
                "status": "ingested",
                "chunks": count,
                "doc_type": doc_type,
                "source": filename,
                "tenant_id": tenant,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════
# 2. RAG-Augmented Audit
# ══════════════════════════════════════════════════════════════════════
class RAGAuditView(APIView):
    """POST /api/rag/audit/  — Policy-aware quality audit with evidence citations."""
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request):
        content  = request.data.get("content", "")
        tenant   = request.data.get("tenant_id", "default")
        user_email = _requested_user_email(request)
        file_obj = request.FILES.get("file")
        filename = "direct_input"

        if file_obj:
            try:
                content = file_obj.read().decode("utf-8")
                filename = file_obj.name
            except Exception:
                return Response({"error": "Could not read file."}, status=400)

        if not content.strip():
            return Response({"error": "No transcript content provided."}, status=400)

        try:
            # Parse transcript into dialogue turns
            from processor.utils import split_transcript_by_speaker
            transcript_data = split_transcript_by_speaker(content)

            engine = get_engine()
            audit  = engine.perform_rag_audit(content, tenant)

            # Persist to DB (same model as existing pipeline)
            from processor.models import AuditResult
            record = AuditResult.objects.create(
                source_type="text",
                filename=filename,
                owner_email=user_email or None,
                transcript_json=transcript_data,
                audit_json=audit,
                overall_score=audit.get("overall_score", 0),
                sentiment=audit.get("sentiment", "Neutral"),
            )
            
            # TRIGGER ALERTS ENGINE automatically
            try:
                from alerts.alert_engine import evaluate_audit
                evaluate_audit(record.id, audit, filename)
            except Exception as e:
                print(f"[AlertEngine] Failed to generate alerts: {e}")
                
            return Response({
                "id":             record.id,
                "source":         "rag_audit",
                "content":        content,
                "transcript":     transcript_data,
                "audit":          audit,
                "policy_context": audit.get("policy_context", []),
                "rag_coverage":   audit.get("rag_coverage", 0.0),
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════
# 3. Semantic Policy Search
# ══════════════════════════════════════════════════════════════════════
class PolicySearchView(APIView):
    """GET /api/rag/search/?q=<query>&k=5&tenant_id=default"""

    def get(self, request):
        query  = request.GET.get("q", "").strip()
        k      = int(request.GET.get("k", 5))
        tenant = request.GET.get("tenant_id", "default")
        if not query:
            return Response({"error": "Query parameter 'q' is required."}, status=400)
        try:
            results = get_engine().query_policy(query, tenant, k)
            return Response({"query": query, "results": results, "count": len(results)})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════
# 4. Analytics Aggregate (from Neon)
# ══════════════════════════════════════════════════════════════════════
class AnalyticsView(APIView):
    """GET /api/rag/analytics/  — Aggregate KPIs from audit history."""

    def get(self, request):
        try:
            from processor.models import AuditResult
            from django.db.models import Avg, Count
            user_email = _requested_user_email(request)
            qs = AuditResult.objects.all()
            if user_email:
                qs = qs.filter(owner_email=user_email)
            total = qs.count()
            if total == 0:
                return Response({"total_audits": 0, "message": "No audit data yet."})

            avg_score   = qs.aggregate(Avg("overall_score"))["overall_score__avg"] or 0
            sentiment_b = {}
            for row in qs.values("sentiment").annotate(count=Count("id")):
                sentiment_b[row["sentiment"]] = row["count"]

            # Score buckets
            excellent = qs.filter(overall_score__gte=80).count()
            good      = qs.filter(overall_score__gte=60, overall_score__lt=80).count()
            poor      = qs.filter(overall_score__lt=60).count()

            # Recent 10 for agent trend
            recent = list(qs.order_by("-created_at")[:10].values(
                "id", "filename", "overall_score", "sentiment", "created_at", "audit_json"
            ))
            for r in recent:
                r["created_at"] = r["created_at"].strftime("%Y-%m-%d %H:%M")
                a = r.pop("audit_json") or {}
                r["agent_performance"] = a.get("agent_performance", "N/A")

                r["compliance_score"] = _extract_dimension_score(a, "compliance")
                r["empathy_score"] = _extract_dimension_score(a, "empathy")

            return Response({
                "total_audits":       total,
                "avg_overall_score":  round(avg_score, 1),
                "sentiment_breakdown": sentiment_b,
                "score_distribution": {
                    "excellent_80_plus": excellent,
                    "good_60_79":        good,
                    "poor_below_60":     poor,
                },
                "recent_audits": recent,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════
# 5. Agent-wise Analytics
# ══════════════════════════════════════════════════════════════════════
class AgentAnalyticsView(APIView):
    """GET /api/rag/agents/  — Per-agent performance from audit history."""

    def get(self, request):
        try:
            from processor.models import AuditResult
            user_email = _requested_user_email(request)
            records = AuditResult.objects.all()
            if user_email:
                records = records.filter(owner_email=user_email)
            records = records.order_by("-created_at")[:100]
            agents  = {}
            for r in records:
                name = r.filename or f"agent_{r.id}"
                key  = name[:40]
                a    = r.audit_json or {}
                if key not in agents:
                    agents[key] = {
                        "agent_id":    key,
                        "total":       0,
                        "score_sum":   0,
                        "empathy_sum": 0,
                        "compliance_sum": 0,
                        "sentiment_counts": {},
                        "recent_score": 0,
                        "performance": a.get("agent_performance", "N/A"),
                    }
                ag = agents[key]
                ag["total"]          += 1
                ag["score_sum"]      += r.overall_score

                emp = _extract_dimension_score(a, "empathy")
                cmp = _extract_dimension_score(a, "compliance")

                ag["empathy_sum"]    += (emp or 0)
                ag["compliance_sum"] += (cmp or 0)
                s = r.sentiment or "Neutral"
                ag["sentiment_counts"][s] = ag["sentiment_counts"].get(s, 0) + 1
                ag["recent_score"]  = r.overall_score

            result = []
            for ag in agents.values():
                n = ag["total"]
                result.append({
                    "agent_id":         ag["agent_id"],
                    "total_audits":     n,
                    "avg_score":        round(ag["score_sum"] / n, 1),
                    "avg_empathy":      round(ag["empathy_sum"] / n, 1),
                    "avg_compliance":   round(ag["compliance_sum"] / n, 1),
                    "recent_score":     ag["recent_score"],
                    "performance":      ag["performance"],
                    "sentiment_counts": ag["sentiment_counts"],
                    "risk_level":       "HIGH" if ag["compliance_sum"] / n < 5 else
                                        "MEDIUM" if ag["score_sum"] / n < 65 else "LOW",
                })
            result.sort(key=lambda x: x["avg_score"], reverse=True)
            return Response({"agents": result, "total": len(result)})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════
# 6. Sentiment Heatmap
# ══════════════════════════════════════════════════════════════════════
class SentimentHeatmapView(APIView):
    """GET /api/rag/sentiment-heatmap/  — 7-day × 24-hour sentiment grid."""

    def get(self, request):
        try:
            from processor.models import AuditResult
            from django.utils import timezone
            import datetime
            now   = timezone.now()
            start = now - datetime.timedelta(days=7)
            qs    = AuditResult.objects.filter(created_at__gte=start)
            user_email = _requested_user_email(request)
            if user_email:
                qs = qs.filter(owner_email=user_email)
            grid  = {}
            for r in qs:
                day  = r.created_at.strftime("%a")
                hour = r.created_at.hour
                key  = f"{day}_{hour}"
                s    = r.sentiment or "Neutral"
                if key not in grid:
                    grid[key] = {"day": day, "hour": hour, "positive": 0, "neutral": 0, "negative": 0, "total": 0}
                grid[key]["total"] += 1
                grid[key][s.lower()] = grid[key].get(s.lower(), 0) + 1
            return Response({"heatmap": list(grid.values()), "days": 7})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════
# 7. Compliance Risk Prediction
# ══════════════════════════════════════════════════════════════════════
class RiskPredictionView(APIView):
    """POST /api/rag/risk/  — Pre-audit compliance risk score."""
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request):
        content = request.data.get("content", "")
        if not content.strip():
            return Response({"error": "content is required."}, status=400)
        try:
            result = get_engine().predict_compliance_risk(content)
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════
# 8. Auto Coaching Report
# ══════════════════════════════════════════════════════════════════════
class CoachingReportView(APIView):
    """POST /api/rag/coaching/  — Generate coaching plan for an audit record."""
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request):
        audit_id = request.data.get("audit_id")
        content  = request.data.get("content", "")
        try:
            audit_data = {}
            if audit_id:
                from processor.models import AuditResult
                record     = AuditResult.objects.get(id=audit_id)
                audit_data = record.audit_json or {}
                content    = content or (record.transcript_json or {}).get("full_text", "")
            if not content:
                return Response({"error": "audit_id or content required."}, status=400)
            coaching = get_engine().generate_coaching_report(content, audit_data)
            return Response(coaching)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════
# 9. AI Supervisor Copilot
# ══════════════════════════════════════════════════════════════════════
class CopilotView(APIView):
    """POST /api/rag/copilot/  — AI Q&A over audit history + policy knowledge."""
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def post(self, request):
        question = request.data.get("question", "").strip()
        if not question:
            return Response({"error": "question is required."}, status=400)
        try:
            history_ctx = _get_history_context()
            result      = get_engine().copilot_answer(question, history_ctx)
            return Response(result)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ══════════════════════════════════════════════════════════════════════
# 10. SSE Streaming Audit (Vercel-compatible fallback)
# ══════════════════════════════════════════════════════════════════════
class StreamAuditView(APIView):
    """GET /api/rag/stream-audit/?content=<text>
    Server-Sent Events streaming — works on Vercel and container backends.
    """

    def get(self, request):
        content = request.GET.get("content", "").strip()
        tenant  = request.GET.get("tenant_id", "default")
        if not content:
            return Response({"error": "content query parameter required."}, status=400)

        def _event_stream():
            engine = get_engine()
            aug_prompt, policy_chunks = engine.augmented_audit_prompt(content, tenant)
            # Emit policy context first
            policy_json = json.dumps({"event": "policy_context", "data": policy_chunks})
            yield f"data: {policy_json}\n\n"

            system_prompt = (
                "You are a quality auditor AI. Analyze the following conversation "
                "and provide quality feedback. Be concise and professional."
            )
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": aug_prompt},
            ]
            from .llm_provider import llm_stream
            buffer = ""
            for token in llm_stream(messages):
                buffer += token
                chunk_json = json.dumps({"event": "token", "data": token})
                yield f"data: {chunk_json}\n\n"

            done_json = json.dumps({"event": "session_complete", "data": {"buffer_length": len(buffer)}})
            yield f"data: {done_json}\n\n"

        response = StreamingHttpResponse(
            _event_stream(),
            content_type="text/event-stream",
        )
        response["Cache-Control"]  = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response
