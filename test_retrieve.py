import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "django_backend.settings")
django.setup()

from rag.rag_engine import get_engine
engine = get_engine()

# Check total collections
print("Collection names:", engine.client.list_collections())

# Test query
res = engine.query_policy("refund", "default", k=3)
print(f"Retrieved {len(res)} chunks for 'refund'.")
for r in res:
    print("-", r['text'])
