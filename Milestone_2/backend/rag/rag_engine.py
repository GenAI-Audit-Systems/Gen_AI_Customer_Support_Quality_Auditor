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
            # Industry-standard fallback context
            context_block = (
                "No specific local policies found. Apply industry-standard customer support best practices: "
                "Verify identity if required, remain professional, show empathy, confirm resolution, "
                "and ensure data privacy (PII protection)."
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
You are a senior Quality Auditor and Compliance Officer for a customer support operation.
Analyze the conversation transcript VERY CAREFULLY for quality AND compliance violations.

COMPLIANCE RED FLAGS you MUST detect (list ALL that apply in compliance_issues):
- PII/Data exposure: Agent asks for or accepts full credit card numbers, SSNs, passwords
- Policy misrepresentation: Agent contradicts official policies (e.g. wrong refund timelines)
- Coercion/intimidation: Agent discourages complaints, threatens delays, pressures customer
- Lack of verification: Agent skips identity verification before accessing accounts
- Unprofessional conduct: Dismissive language, belittling the customer's concerns
- Unauthorized promises: Agent offers deals/workarounds outside standard procedure
- Missing confirmation: Agent fails to provide confirmation emails/reference numbers
- Escalation refusal: Agent refuses to transfer to supervisor when requested

Score STRICTLY — a conversation with multiple violations should get compliance 1-3/10, overall_score below 30.

Return STRICT JSON (no markdown, no extra text):
{
  "summary": "2-3 sentence executive summary",
  "scores": {
    "empathy": 0-10, "resolution": 0-10,
    "professionalism": 0-10, "compliance": 0-10
  },
  "metric_justifications": {
    "empathy": "1-2 sentences with evidence",
    "resolution": "...", "professionalism": "...", "compliance": "..."
  },
  "overall_score": 0-100,
  "sentiment": "Positive/Neutral/Negative",
  "agent_performance": "Excellent/Good/Satisfactory/Needs Improvement/Poor",
  "call_outcome": "Resolved/Partially Resolved/Unresolved/Escalated",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "improvement_tips": ["Tip 1", "Tip 2", "Tip 3"],
  "compliance_issues": ["List EVERY SINGLE compliance violation detected. THIS MUST NOT BE EMPTY IF compliance SCORE < 10"],
  "policy_references": ["Source 1", "Source 2"],
  "rag_coverage": 0.0
}
Only return valid JSON. No extra text.
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
            audit["rag_coverage"] = round(len(policy_chunks) / max(len(policy_chunks), 1), 2)

        return audit

    def _fallback_audit(self, raw_text: str) -> dict:
        """Return a structured fallback when LLM output isn't valid JSON."""
        return {
            "summary": raw_text[:500] if raw_text else "Audit analysis completed.",
            "scores": {"empathy": 5, "resolution": 5, "professionalism": 5, "compliance": 5},
            "overall_score": 50,
            "sentiment": "Neutral",
            "agent_performance": "Satisfactory",
            "call_outcome": "Partially Resolved",
            "key_findings": ["LLM returned non-structured output"],
            "improvement_tips": ["Review transcript manually for detailed insights"],
            "compliance_issues": [],
            "policy_references": [],
            "rag_coverage": 0.0,
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
