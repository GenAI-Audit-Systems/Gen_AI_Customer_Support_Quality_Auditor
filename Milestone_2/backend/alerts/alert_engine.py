# ══════════════════════════════════════════════════════════════════════
# Compliance Alert Engine
# Rule evaluation, severity classification, PII masking, webhook dispatch
# Circuit breaker + retry queue for external delivery
# ══════════════════════════════════════════════════════════════════════
import os
import re
import json
import time
import requests
import threading

ALERT_WEBHOOK = os.getenv("ALERT_WEBHOOK_URL", "")

# ── Alert rules (configurable per tenant) ─────────────────────────────
DEFAULT_RULES = [
    {
        "name":        "critical_compliance_failure",
        "severity":    "CRITICAL",
        "description": "Compliance score below 5 — immediate review required.",
        "check":       lambda a: (a.get("scores") or {}).get("compliance", 10) < 5,
    },
    {
        "name":        "low_overall_score",
        "severity":    "WARNING",
        "description": "Overall quality score below 50.",
        "check":       lambda a: a.get("overall_score", 100) < 50,
    },
    {
        "name":        "compliance_issues_detected",
        "severity":    "INFO",
        "description": "One or more compliance issues flagged by the LLM.",
        "check":       lambda a: len(a.get("compliance_issues") or []) > 0,
    },
    {
        "name":        "poor_empathy",
        "severity":    "WARNING",
        "description": "Empathy score below 4 — coaching recommended.",
        "check":       lambda a: (a.get("scores") or {}).get("empathy", 10) < 4,
    },
    {
        "name":        "unresolved_call",
        "severity":    "INFO",
        "description": "Call outcome marked as Unresolved or Escalated.",
        "check":       lambda a: a.get("call_outcome", "Resolved") in ("Unresolved", "Escalated"),
    },
]

# ── PII masking ────────────────────────────────────────────────────────
_PII_PATTERNS = [
    (re.compile(r"\b[\w.-]+@[\w.-]+\.\w{2,}\b"),             "[EMAIL]"),
    (re.compile(r"\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b"),       "[PHONE]"),
    (re.compile(r"\b(?:\d[ -]*?){13,16}\b"),                  "[CARD]"),
    (re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),                    "[SSN]"),
    (re.compile(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"),  "[IP]"),
]


def mask_pii(text: str) -> str:
    for pattern, replacement in _PII_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def mask_payload(payload: dict) -> dict:
    """Recursively mask PII in a JSON-serializable dict."""
    out = {}
    for k, v in payload.items():
        if isinstance(v, str):
            out[k] = mask_pii(v)
        elif isinstance(v, dict):
            out[k] = mask_payload(v)
        elif isinstance(v, list):
            out[k] = [mask_pii(i) if isinstance(i, str) else i for i in v]
        else:
            out[k] = v
    return out


# ── Deduplication store (in-memory; production: use Redis SETEX) ──────
_fired: dict = {}   # key: f"{audit_id}:{rule_name}" → timestamp
DEDUP_WINDOW = 600  # 10 minutes


def _is_duplicate(audit_id: int, rule_name: str) -> bool:
    key = f"{audit_id}:{rule_name}"
    last = _fired.get(key, 0)
    if time.time() - last < DEDUP_WINDOW:
        return True
    _fired[key] = time.time()
    return False


# ── Webhook dispatch with circuit breaker + retry ─────────────────────
_cb_failures  = 0
_cb_open_until = 0
CB_THRESHOLD   = 3        # open after 3 consecutive failures
CB_RESET       = 60       # seconds before trying again


def _dispatch_webhook(payload: dict):
    """Background thread: POST alert payload to ALERT_WEBHOOK_URL."""
    global _cb_failures, _cb_open_until
    if not ALERT_WEBHOOK:
        return
    if time.time() < _cb_open_until:
        print(f"[AlertEngine] Circuit breaker OPEN — skipping webhook.")
        return
    masked = mask_payload(payload)
    for attempt in range(1, 4):
        try:
            r = requests.post(ALERT_WEBHOOK, json=masked, timeout=10)
            r.raise_for_status()
            _cb_failures = 0
            return
        except Exception as e:
            _cb_failures += 1
            if _cb_failures >= CB_THRESHOLD:
                _cb_open_until = time.time() + CB_RESET
                print(f"[AlertEngine] Circuit breaker opened after {_cb_failures} failures.")
                return
            wait = 2 ** attempt
            print(f"[AlertEngine] Webhook attempt {attempt} failed: {e}. Retrying in {wait}s.")
            time.sleep(wait)


# ═══════════════════════════════════════════════════════════════════════
# Main evaluation function
# ═══════════════════════════════════════════════════════════════════════
def evaluate_audit(audit_id: int, audit_json: dict, agent_id: str = "unknown") -> list:
    """
    Evaluate audit against all rules.
    Creates AlertRecord entries in Neon and dispatches webhooks for each triggered rule.
    Returns list of created AlertRecord dicts.
    """
    from .models import AlertRecord
    created = []
    for rule in DEFAULT_RULES:
        try:
            triggered = rule["check"](audit_json)
        except Exception:
            triggered = False
        if not triggered:
            continue
        if _is_duplicate(audit_id, rule["name"]):
            continue

        payload = {
            "audit_id":    audit_id,
            "agent_id":    agent_id,
            "rule":        rule["name"],
            "severity":    rule["severity"],
            "description": rule["description"],
            "scores":      audit_json.get("scores", {}),
            "summary":     audit_json.get("summary", ""),
        }

        record = AlertRecord.objects.create(
            audit_id    = audit_id,
            agent_id    = agent_id,
            severity    = rule["severity"],
            rule_name   = rule["name"],
            description = rule["description"],
            payload     = mask_payload(payload),
        )
        created.append({
            "id":          record.id,
            "severity":    record.severity,
            "rule":        record.rule_name,
            "description": record.description,
        })
        # Async webhook dispatch
        if ALERT_WEBHOOK:
            t = threading.Thread(target=_dispatch_webhook, args=(payload,), daemon=True)
            t.start()

    return created
