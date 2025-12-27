import requests
import json

url = "http://localhost:8000/export/download/xlsm"
payload = {"model_ids": [3], "listing_type": "Create"}
headers = {"Content-Type": "application/json"}

print(f"Sending POST to {url} with {payload}")
try:
    r = requests.post(url, json=payload, headers=headers)
    print(f"Status: {r.status_code}")
    if r.status_code != 200:
        print(f"Response: {r.text}")
    else:
        print("Success! XLSM content received.")
        print(f"Content-Length: {len(r.content)}")
except Exception as e:
    print(f"Error: {e}")
