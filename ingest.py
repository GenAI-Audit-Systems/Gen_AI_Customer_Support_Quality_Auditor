import requests
try:
    with open(r'C:\Users\kpriy\Desktop\Milestone2\company_policy.txt', 'rb') as f:
        resp = requests.post('http://localhost:8000/api/rag/ingest/', data={'doc_type': 'Support SOP'}, files={'file': f})
        print("Ingest Output:", resp.text)
except Exception as e:
    print("Error:", e)
