# ══════════════════════════════════════════════════════════════════════
# RAG App Config — triggers policy auto-ingestion on Django startup
# ══════════════════════════════════════════════════════════════════════
from django.apps import AppConfig


class RagConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "rag"

    def ready(self):
        # Background thread: ingest sample policies into Milvus on startup
        try:
            from .policy_store import autoload_sample_policies
            # autoload_sample_policies()
            print("[RAG] Policy auto-load skipped (manual disable).")
        except Exception as e:

            print(f"[RAG] Policy auto-load skipped: {e}")
