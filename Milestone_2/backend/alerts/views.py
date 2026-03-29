# ══════════════════════════════════════════════════════════════════════
# Alerts API Views
# POST /api/alerts/check/         — evaluate audit → create alerts
# GET  /api/alerts/history/       — paginated alert list
# GET  /api/alerts/report/pdf/<id>/  — PDF download
# GET  /api/alerts/report/excel/  — Excel download
# POST /api/alerts/webhook-test/  — test webhook delivery
# PATCH /api/alerts/<id>/review/  — mark alert as reviewed
# ══════════════════════════════════════════════════════════════════════
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import JSONParser

from .alert_engine import evaluate_audit, _dispatch_webhook
from .models import AlertRecord
from .report_generator import generate_pdf_report
from .excel_generator import generate_excel_report


def _requested_user_email(request):
    return (request.data.get("user_email") or request.GET.get("user_email") or "").strip().lower()


# ── 1. Evaluate an audit for compliance alerts ─────────────────────────
class AlertCheckView(APIView):
    """POST /api/alerts/check/"""
    parser_classes = (JSONParser,)

    def post(self, request):
        audit_id = request.data.get("audit_id")
        if not audit_id:
            return Response({"error": "audit_id is required."}, status=400)
        try:
            from processor.models import AuditResult
            record   = AuditResult.objects.get(id=audit_id)
            alerts   = evaluate_audit(
                audit_id  = record.id,
                audit_json= record.audit_json or {},
                agent_id  = record.filename or "unknown",
            )
            return Response({
                "audit_id":       audit_id,
                "alerts_created": len(alerts),
                "alerts":         alerts,
            })
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ── 2. Alert history list ──────────────────────────────────────────────
class AlertHistoryView(APIView):
    """GET /api/alerts/history/?severity=CRITICAL&limit=50"""

    def get(self, request):
        severity = request.GET.get("severity", "")
        limit    = int(request.GET.get("limit", 50))
        qs = AlertRecord.objects.all()
        user_email = _requested_user_email(request)
        if user_email:
            from processor.models import AuditResult
            owned_audit_ids = AuditResult.objects.filter(owner_email=user_email).values_list("id", flat=True)
            qs = qs.filter(audit_id__in=owned_audit_ids)
        if severity:
            qs = qs.filter(severity=severity)
        qs = qs[:limit]
        try:
            data = [{
                "id":          a.id,
                "audit_id":    a.audit_id,
                "agent_id":    a.agent_id,
                "severity":    a.severity,
                "rule":        a.rule_name,
                "description": a.description,
                "dispatched":  a.dispatched,
                "reviewed":    a.reviewed,
                "created_at":  a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "N/A",
            } for a in qs]
            return Response({"alerts": data, "total": len(data)})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ── 3. PDF Report Download ─────────────────────────────────────────────
class PDFReportView(APIView):
    """GET /api/alerts/report/pdf/<audit_id>/"""

    def get(self, request, audit_id):
        try:
            from processor.models import AuditResult
            record  = AuditResult.objects.get(id=audit_id)
            pdf_bytes = generate_pdf_report(record)
            response  = HttpResponse(pdf_bytes, content_type="application/pdf")
            response["Content-Disposition"] = (
                f'attachment; filename="audit_report_{audit_id}.pdf"'
            )
            return response
        except AuditResult.DoesNotExist:
            return Response({"error": f"Audit {audit_id} not found."}, status=404)
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ── 4. Excel Analytics Download ────────────────────────────────────────
class ExcelReportView(APIView):
    """GET /api/alerts/report/excel/?limit=200"""

    def get(self, request):
        try:
            from processor.models import AuditResult
            limit   = int(request.GET.get("limit", 200))
            records = AuditResult.objects.all().order_by("-created_at")[:limit]
            xl_bytes = generate_excel_report(records)
            response = HttpResponse(
                xl_bytes,
                content_type=(
                    "application/vnd.openxmlformats-officedocument"
                    ".spreadsheetml.sheet"
                ),
            )
            response["Content-Disposition"] = (
                'attachment; filename="ai_auditor_analytics.xlsx"'
            )
            return response
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ── 5. Webhook Test ────────────────────────────────────────────────────
class WebhookTestView(APIView):
    """POST /api/alerts/webhook-test/"""
    parser_classes = (JSONParser,)

    def post(self, request):
        test_payload = {
            "event":       "webhook_test",
            "audit_id":    0,
            "severity":    "INFO",
            "rule":        "test_rule",
            "description": "Webhook connectivity test from AI Auditor.",
        }
        try:
            _dispatch_webhook(test_payload)
            return Response({"status": "dispatched", "payload": test_payload})
        except Exception as e:
            return Response({"error": str(e)}, status=500)


# ── 6. Mark alert as reviewed ──────────────────────────────────────────
class AlertReviewView(APIView):
    """PATCH /api/alerts/<alert_id>/review/"""

    def patch(self, request, alert_id):
        try:
            alert          = AlertRecord.objects.get(id=alert_id)
            alert.reviewed = True
            alert.save(update_fields=["reviewed"])
            return Response({"id": alert_id, "reviewed": True})
        except AlertRecord.DoesNotExist:
            return Response({"error": "Alert not found."}, status=404)
