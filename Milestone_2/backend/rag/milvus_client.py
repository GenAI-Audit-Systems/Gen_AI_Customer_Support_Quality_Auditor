# Mock Milvus Client to prevent connection errors on Windows
MILVUS_AVAILABLE = False
MILVUS_URI = "mock"
MILVUS_TOKEN = ""

def get_collection(name: str):
    return None

def submit_async(fn, *args, **kwargs):
    # Just run it sync or skip it
    return None

def _ensure_connected():
    pass
