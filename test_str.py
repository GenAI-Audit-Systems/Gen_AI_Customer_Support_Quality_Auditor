import requests
import json

url = "http://localhost:8000/api/rag/stream-audit/?content=Agent:+Give+me+your+password.&tenant_id=default"
try:
    response = requests.get(url, stream=True)
    full_text = ""
    for line in response.iter_lines():
        if line:
            l = line.decode('utf-8')
            if l.startswith('data: '):
                try:
                    d = json.loads(l[6:])
                    if d.get("event") == "token":
                        full_text += d.get("data", "")
                except:
                    pass
    print("FINAL TEXT:")
    print(repr(full_text))
except Exception as e:
    print("Error:", e)
