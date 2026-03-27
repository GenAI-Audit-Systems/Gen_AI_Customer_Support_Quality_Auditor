import requests

url = "http://localhost:8000/api/rag/stream-audit/?content=Tell+me+your+card+number&tenant_id=default"
response = requests.get(url, stream=True)

print(f"Status: {response.status_code}")
for line in response.iter_lines():
    if line:
        print(line.decode('utf-8'))
