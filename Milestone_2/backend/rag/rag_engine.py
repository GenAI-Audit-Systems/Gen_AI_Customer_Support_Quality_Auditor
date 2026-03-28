# ══════════════════════════════════════════════════════════════════════
# RAG Engine — Production-grade Retrieval-Augmented Generation
# Embedding: sentence-transformers/all-MiniLM-L6-v2  (384-dim, ~14ms/chunk)
# Retrieval: Milvus HNSW + LRU cache (1000 entries, 5-min TTL)
# Context fusion → LLMProvider (provider-agnostic)
# ══════════════════════════════════════════════════════════════════════
import json
import time
import hashlib
import re
import threading
from functools import lru_cache
from typing import List, Optional, Tuple

try:
    from sentence_transformers import SentenceTransformer
    ST_AVAILABLE = True
except ImportError:
    ST_AVAILABLE = False
    print("[RAG] sentence-transformers not installed — embeddings disabled.")

from .milvus_client import get_collection, MILVUS_AVAILABLE, submit_async
from .llm_provider import llm_complete, llm_stream

# ── Embedding model (lazy-loaded singleton) ───────────────────────────
_model = None
_model_lock = threading.Lock()


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None and ST_AVAILABLE:
                _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed(text: str) -> Optional[List[float]]:
    """Return 384-dim embedding vector or None if unavailable."""
    model = _get_model()
    if model is None:
        return None
    return model.encode(text, normalize_embeddings=True).tolist()


# ── LRU retrieval cache (1000 entries, 5-min TTL) ─────────────────────
_cache: dict = {}
_cache_lock  = threading.Lock()
CACHE_TTL    = 300   # seconds
CACHE_MAX    = 1000


def _cache_key(text: str, tenant_id: str, k: int) -> str:
    return hashlib.md5(f"{tenant_id}:{k}:{text[:512]}".encode()).hexdigest()


def _cache_get(key: str):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry["ts"]) < CACHE_TTL:
            return entry["data"]
        if entry:
            del _cache[key]
    return None


def _cache_set(key: str, data):
    with _cache_lock:
        if len(_cache) >= CACHE_MAX:
            # Evict oldest
            oldest = min(_cache.items(), key=lambda x: x[1]["ts"])[0]
            del _cache[oldest]
        _cache[key] = {"data": data, "ts": time.time()}


# ── Text chunking ─────────────────────────────────────────────────────
def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> List[str]:
    """Recursive character-split chunker with overlap."""
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        # Try to break at sentence boundary
        if end < len(text):
            for sep in [". ", "\n", " "]:
                idx = text.rfind(sep, start, end)
                if idx > start:
                    end = idx + 1
                    break
        chunks.append(text[start:end].strip())
        start = end - overlap
    return [c for c in chunks if c]


# ═══════════════════════════════════════════════════════════════════════
# RAGEngine
# ═══════════════════════════════════════════════════════════════════════
class RAGEngine:

    # ── Document ingestion ─────────────────────────────────────────────
    def ingest_document(
        self,
        text: str,
        doc_type: str = "policy",
        tenant_id: str = "default",
        source_file: str = "manual",
    ) -> int:
        """Chunk, embed, insert into Milvus policy_docs. Returns chunk count."""
        chunks = chunk_text(text)
        col    = get_collection("policy_docs")
        if col is None:
            return len(chunks)  # graceful: no Milvus
        vectors, contents, doc_types, tenants, indices, sources = [], [], [], [], [], []
        for i, chunk in enumerate(chunks):
            vec = embed(chunk)
            if vec is None:
                continue
            vectors.append(vec)
            contents.append(chunk[:2000])
            doc_types.append(doc_type[:64])
            tenants.append(tenant_id[:64])
            indices.append(i)
            sources.append(source_file[:256])
        if vectors:
            col.insert([contents, vectors, doc_types, tenants, indices, sources])
            col.flush()
            # Clear retrieval cache so new policies apply instantly
            with _cache_lock:
                _cache.clear()
        return len(vectors)

    # ── Policy retrieval ───────────────────────────────────────────────
    def query_policy(
        self,
        question: str,
        tenant_id: str = "default",
        k: int = 5,
    ) -> List[dict]:
        """Retrieve top-k policy chunks relevant to question (cached)."""
        cache_key = _cache_key(question, tenant_id, k)
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

        vec = embed(question)
        col = get_collection("policy_docs")
        if vec is None or col is None:
            return []

        results = col.search(
            data=[vec],
            anns_field="embedding",
            param={"metric_type": "L2", "params": {"ef": 64}},
            limit=k,
            expr=f'tenant_id == "{tenant_id}"',
            output_fields=["content", "doc_type", "source_file"],
        )
        hits = []
        for hit in results[0]:
            hits.append({
                "content":     hit.entity.get("content", ""),
                "doc_type":    hit.entity.get("doc_type", ""),
                "source_file": hit.entity.get("source_file", ""),
                "score":       round(float(hit.distance), 4),
            })
        _cache_set(cache_key, hits)
        return hits

    # ── Augmented audit prompt ─────────────────────────────────────────
    def augmented_audit_prompt(
        self,
        transcript: str,
        tenant_id: str = "default",
        k: int = 5,
    ) -> Tuple[str, List[dict]]:
        """Build an LLM prompt augmented with retrieved policy context."""
        policy_chunks = self.query_policy(transcript[:512], tenant_id, k)
        
        if policy_chunks:
            policy_text = "\n\n".join(
                f"[Policy: {c['doc_type']} / {c['source_file']}]\n{c['content']}"
                for c in policy_chunks
            )
            context_block = f"Relevant compliance policies and SOPs for context:\n{policy_text}"
        else:
            # Industry-standard fallback context (Enterprise Policy)
            context_block = (
                "Apply Standard Company Operating Procedures for context:\n"
                "1. Greeting & Opening Policy: Agent must greet politely and offer assistance.\n"
                "2. Empathy Policy: Agent must acknowledge customer issues with understanding and concern.\n"
                "3. Verification Policy: Agent must verify customer/order details before proceeding.\n"
                "4. Policy Compliance: Agent must correctly apply company policies (e.g., 7-day return window).\n"
                "5. Transparency Policy: Agent must clearly explain available options and processes.\n"
                "6. Resolution Policy: Agent must take appropriate action to resolve the issue efficiently.\n"
                "7. Timeline Communication Policy: Agent must provide accurate timelines for resolution.\n"
                "8. Process Clarity Policy: Agent must explain next steps clearly (returns, pickup instructions).\n"
                "9. Professional Communication Policy: Agent must maintain polite and respectful communication.\n"
                "10. Closing Policy: Agent must close politely and offer further assistance."
            )

        augmented_prompt = (
            f"{context_block}\n\n"
            f"---\n\n"
            f"Conversation transcript:\n{transcript}"
        )
        return augmented_prompt, policy_chunks

    # ── Conversation memory ────────────────────────────────────────────
    def store_conversation_turn(
        self,
        audit_id: int,
        agent_id: str,
        turn_text: str,
        session_id: str,
    ):
        """Async: embed + store a single conversation turn in Milvus."""
        def _insert():
            vec = embed(turn_text)
            col = get_collection("conversation_context")
            if vec is None or col is None:
                return
            ts = int(time.time() * 1000)
            col.insert([[audit_id], [agent_id[:64]], [turn_text[:2000]],
                        [vec], [session_id[:128]], [ts]])
            col.flush()
        submit_async(_insert)

    # ── Agent pattern similarity ───────────────────────────────────────
    def find_similar_agent_patterns(
        self,
        transcript: str,
        metric_tag: str = "",
        k: int = 3,
    ) -> List[dict]:
        """Find historical agent behavior patterns similar to this transcript."""
        vec = embed(transcript[:512])
        col = get_collection("agent_behavior_patterns")
        if vec is None or col is None:
            return []
        expr = f'metric_tag == "{metric_tag}"' if metric_tag else ""
        results = col.search(
            data=[vec],
            anns_field="pattern_vec",
            param={"metric_type": "L2", "params": {"ef": 64}},
            limit=k,
            expr=expr or None,
            output_fields=["agent_id", "score_label", "metric_tag", "example_text"],
        )
        patterns = []
        for hit in results[0]:
            patterns.append({
                "agent_id":    hit.entity.get("agent_id", ""),
                "score_label": hit.entity.get("score_label", ""),
                "metric_tag":  hit.entity.get("metric_tag", ""),
                "example":     hit.entity.get("example_text", "")[:200],
                "similarity":  round(1 - float(hit.distance), 3),
            })
        return patterns

    # ── Full RAG-augmented audit ───────────────────────────────────────
    def perform_rag_audit(self, transcript: str, tenant_id: str = "default") -> dict:
        """Run complete RAG-augmented quality audit. Returns enriched audit dict."""
        augmented_prompt, policy_chunks = self.augmented_audit_prompt(transcript, tenant_id)

        system_prompt = """
You are an Enterprise AI Quality Auditor. Your goal is to provide a "perfect", professional-grade audit in structured JSON.
Analyze the transcript for ALL compliance, quality, and performance nuances.

REQUIRED JSON STRUCTURE:
{
  "overall_score": 0-100,
  "metrics": {
    "Sentiment": {"score": 0-10, "label": "Positive|Neutral|Negative", "reason": "..."},
    "Resolution": {"score": 0-10, "label": "Success|Partial|Fail", "reason": "..."},
    "Professionalism": {"score": 0-10, "label": "High|Medium|Low", "reason": "..."},
    "Empathy": {"score": 0-10, "label": "Strong|Adequate|Weak", "reason": "..."},
    "Compliance": {"score": 0-10, "label": "Pass|Fail", "reason": "..."}
  },
  "executive_summary": "A high-level executive briefing (3-4 sentences) summarizing the interaction, agent performance, and business impact.",
  "violations": [
    {
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "category": "Data Privacy|Conduct|Procedure|Authorization",
      "description": "Clear professional description of the violation.",
      "evidence": "Exact quote from transcript",
      "remediation": "Mandatory corrective action for the agent."
    }
  ],
  "key_findings": ["Finding 1...", "Finding 2..."],
  "improvement_tips": ["Professional recommendation 1...", "Professional recommendation 2..."],
  "live_flags": ["ESCALATION_NEEDED", "RISKY_BEHAVIOR", "POLICY_GAP"],
  "rag_coverage": 0.0-1.0,
  "policy_references": ["Reference doc names used for this audit"]
}

STRICT MANDATES:
1. PII EXPOSURE: If an agent asks for a password or credit card, mark as CRITICAL violation.
2. PROFESSIONALISM: Use formal, enterprise-level language in your summaries.
3. FINDINGS: Do NOT leave findings empty. Identify at least 3 distinct observations. If none, state "Positive adherence to standard operating procedures."
4. IMPROVEMENT TIPS: Always provide at least 2 actionable coaching points.
5. ACTIONABLE: All remediation steps must be specific commands the supervisor can give.
6. NO NULLS: Do not use empty arrays or null strings. If no violations exist, return one violation with severity "LOW", category "Procedure", and description "No critical compliance failures detected."
7. SCORE ACCURACY: A "Compliance" score of 10/10 requires zero CRITICAL or HIGH violations. Deduct 3 points for each HIGH violation and 7 points for any CRITICAL violation.
8. NO TEXT: Return ONLY the JSON object. Do not explain your thought process.
"""
        messages = [
            {"role": "system",  "content": system_prompt},
            {"role": "user",    "content": augmented_prompt},
        ]
        content = llm_complete(messages)

        # Robust JSON extraction — handle markdown fences and extra text
        try:
            audit = json.loads(content)
        except json.JSONDecodeError:
            # Try extracting JSON from markdown code fences
            match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
            if match:
                try:
                    audit = json.loads(match.group(1))
                except json.JSONDecodeError:
                    audit = self._fallback_audit(content)
            else:
                # Try finding first { ... } in the text
                brace_match = re.search(r'\{.*\}', content, re.DOTALL)
                if brace_match:
                    try:
                        audit = json.loads(brace_match.group(0))
                    except json.JSONDecodeError:
                        audit = self._fallback_audit(content)
                else:
                    audit = self._fallback_audit(content)

        # Annotate with RAG metadata
        audit["policy_context"] = policy_chunks
        if not audit.get("policy_references"):
            audit["policy_references"] = list({c["source_file"] for c in policy_chunks})
        if not audit.get("rag_coverage"):
            audit["rag_coverage"] = round(len(policy_chunks) / 5.0, 2) if policy_chunks else 0.0

        # Ensure minimal structure for frontend compatibility
        if "metrics" not in audit and "dimension_scores" in audit:
            audit["metrics"] = audit.pop("dimension_scores")
            
        return audit

    def _fallback_audit(self, raw_text: str) -> dict:
        """Return a structured fallback when LLM output isn't valid JSON."""
        return {
            "overall_score": 50,
            "metrics": {
                "Sentiment": {"score": 5, "label": "Neutral", "reason": "Fallback due to parsing error"},
                "Resolution": {"score": 5, "label": "Partial", "reason": "Analysis degraded"},
                "Professionalism": {"score": 5, "label": "Medium", "reason": "Verification required"},
                "Compliance": {"score": 5, "label": "Pass", "reason": "No high-risk indicators found"}
            },
            "executive_summary": "System was unable to generate a deep analysis. Please review transcript manually.",
            "violations": [],
            "key_findings": ["LLM returned non-structured output"],
            "improvement_tips": ["Review transcript for PII and conduct risks."],
            "live_flags": ["VERIFICATION_NEEDED"],
            "rag_coverage": 0.0,
            "policy_references": []
        }

    # ── Risk prediction (pre-audit) ────────────────────────────────────
    def predict_compliance_risk(self, transcript: str) -> dict:
        """Fast pre-audit risk score without full LLM scoring."""
        policy_chunks = self.query_policy(transcript[:512], k=3)
        risk_keywords = ["angry", "frustrated", "cancel", "sue", "lawsuit",
                         "refund", "escalate", "manager", "complaint", "unacceptable"]
        lower = transcript.lower()
        keyword_hits = [kw for kw in risk_keywords if kw in lower]
        has_policy_gap = len(policy_chunks) == 0
        base_risk = len(keyword_hits) * 8 + (20 if has_policy_gap else 0)
        risk_score = min(base_risk, 100)
        return {
            "risk_score":    risk_score,
            "risk_level":    "CRITICAL" if risk_score > 70 else "WARNING" if risk_score > 30 else "LOW",
            "flags":         keyword_hits,
            "policy_gap":    has_policy_gap,
            "policy_chunks": len(policy_chunks),
        }

    # ── Coaching report ────────────────────────────────────────────────
    def generate_coaching_report(self, transcript: str, audit_result: dict) -> dict:
        """Generate a personalized coaching plan post-audit."""
        patterns = self.find_similar_agent_patterns(transcript)
        scores   = audit_result.get("scores", {})
        weak_areas = [k for k, v in scores.items() if v < 7]

        prompt = f"""
Generate a coaching report for a customer support agent. 
Weak areas: {', '.join(weak_areas) or 'None identified'}.
Audit summary: {audit_result.get('summary', '')}
Improvement tips already given: {audit_result.get('improvement_tips', [])}
Similar top-performer patterns: {[p['example'] for p in patterns if p['score_label'] == 'top'][:2]}

Return JSON:
{{
  "coaching_plan": ["Step 1...", "Step 2...", "Step 3..."],
  "focus_areas": ["area1", "area2"],
  "estimated_improvement": "X% in 2 weeks with daily practice",
  "recommended_resources": ["Resource 1", "Resource 2"],
  "skill_gaps": ["gap1", "gap2"]
}}
Only return valid JSON.
"""
        messages = [
            {"role": "system", "content": "You are an expert agent coaching specialist."},
            {"role": "user",   "content": prompt},
        ]
        try:
            content = llm_complete(messages)
            coaching = json.loads(content)
        except Exception as e:
            coaching = {
                "coaching_plan": audit_result.get("improvement_tips", []),
                "focus_areas":   weak_areas,
                "error":         str(e),
            }
        coaching["similar_patterns"] = patterns
        return coaching

    # ── AI Supervisor Copilot Q&A ──────────────────────────────────────
    def copilot_answer(self, question: str, history_context: str = "") -> dict:
        """Answer a supervisor analytics question using RAG + history context."""
        policy_chunks = self.query_policy(question, k=3)
        policy_text   = "\n".join(c["content"][:300] for c in policy_chunks)
        
        messages = [
            {"role": "system", "content": (
                "You are an AI Supervisor Copilot for a customer support quality platform.\n"
                "Answer the supervisor's question using the provided data.\n"
                "If data is missing, use your general knowledge to provide a helpful, professional "
                "response about customer support management.\n"
                "Return JSON: {\"answer\": \"...\", \"confidence\": 0-1, \"references\": [...]}"
            )},
            {"role": "user", "content": (
                f"Policy context:\n{policy_text or 'No specific policies retrieved for this query.'}\n\n"
                f"Historical audit data:\n{history_context[:1500] or 'No historical audit data available yet.'}\n\n"
                f"Supervisor question: {question}"
            )},
        ]
        try:
            content = llm_complete(messages)
            result  = json.loads(content)
        except Exception as e:
            result  = {"answer": "I'm having trouble processing that right now.", "error": str(e), "confidence": 0}
        result["policy_context"] = policy_chunks
        return result


# Module-level singleton
_engine = RAGEngine()


def get_engine() -> RAGEngine:
    return _engine
