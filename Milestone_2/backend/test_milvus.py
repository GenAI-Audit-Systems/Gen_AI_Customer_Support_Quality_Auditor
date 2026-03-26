from pymilvus import connections
import os

uri = "./milvus_test.db"
print(f"Testing connection to: {uri}")
try:
    connections.connect(alias="default", uri=uri)
    print("Successfully connected to local Milvus DB!")
except Exception as e:
    print(f"Failed to connect: {e}")
finally:
    if os.path.exists(uri):
        os.remove(uri)
