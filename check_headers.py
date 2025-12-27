import requests
try:
    r = requests.post("http://localhost:8000/export/download/xlsm", json={"model_ids": [3], "listing_type": "Create"}, stream=True)
    print(r.headers.get("Content-Disposition"))
    print(r.headers.get("Content-Type"))
except Exception as e:
    print(e)
