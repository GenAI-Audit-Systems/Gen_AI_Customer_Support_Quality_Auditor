# ══════════════════════════════════════════════════════════════════════
# Policy Store — startup auto-ingestion from sample_policies/ directory
# Hash-based dedup: skips docs already indexed in Milvus
# Runs in background thread via Django AppConfig.ready()
# ══════════════════════════════════════════════════════════════════════
import os
import hashlib
import threading

_ingested_hashes: set = set()
_lock = threading.Lock()


def _get_engine():
    from .rag_engine import get_engine
    return get_engine()


def _file_hash(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.md5(f.read()).hexdigest()


def _ingest_file(path: str, doc_type: str, tenant_id: str = "default"):
    h = _file_hash(path)
    with _lock:
        if h in _ingested_hashes:
            return 0
        _ingested_hashes.add(h)
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    engine = _get_engine()
    count = engine.ingest_document(
        text=text,
        doc_type=doc_type,
        tenant_id=tenant_id,
        source_file=os.path.basename(path),
    )
    print(f"[PolicyStore] Ingested '{os.path.basename(path)}' → {count} chunks.")
    return count


TYPE_MAP = {
    "compliance": "policy",
    "sop": "sop",
    "script": "script",
    "training": "training",
    "history": "history",
}


def autoload_sample_policies():
    """Load all .txt files from rag/sample_policies/ into Milvus (background)."""
    def _run():
        base = os.path.join(os.path.dirname(__file__), "sample_policies")
        if not os.path.isdir(base):
            print("[PolicyStore] sample_policies/ directory not found — skipping.")
            return
        for fname in os.listdir(base):
            if not fname.endswith(".txt"):
                continue
            fpath = os.path.join(base, fname)
            # Infer doc_type from filename
            doc_type = "policy"
            for key, val in TYPE_MAP.items():
                if key in fname.lower():
                    doc_type = val
                    break
            try:
                _ingest_file(fpath, doc_type)
            except Exception as e:
                print(f"[PolicyStore] Failed to ingest '{fname}': {e}")
        print("[PolicyStore] Auto-ingestion complete.")

    t = threading.Thread(target=_run, daemon=True, name="policy-store-loader")
    t.start()


def ingest_uploaded_document(text: str, filename: str,
                              doc_type: str = "policy",
                              tenant_id: str = "default") -> int:
    """Manually ingest an uploaded document. Returns chunk count."""
    h = hashlib.md5(text.encode()).hexdigest()
    with _lock:
        if h in _ingested_hashes:
            return 0
        _ingested_hashes.add(h)
    return _get_engine().ingest_document(text, doc_type, tenant_id, filename)
