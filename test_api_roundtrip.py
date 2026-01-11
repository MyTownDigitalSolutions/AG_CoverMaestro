import requests
import json

BASE = "http://localhost:8000"

# Get a model
resp = requests.get(f"{BASE}/models/1")
model = resp.json()
print("BEFORE:")
print(f"  exclude_from_amazon_export: {model.get('exclude_from_amazon_export')}")

# Update to True
model['exclude_from_amazon_export'] = True
resp = requests.put(f"{BASE}/models/1", json=model)
print(f"\nUPDATE status: {resp.status_code}")
if resp.status_code == 200:
    updated = resp.json()
    print(f"  Response exclude_from_amazon_export: {updated.get('exclude_from_amazon_export')}")
else:
    print(f"  ERROR: {resp.text[:200]}")

# Fetch again
resp = requests.get(f"{BASE}/models/1")
refetched = resp.json()
print("\nAFTER REFETCH:")
print(f"  exclude_from_amazon_export: {refetched.get('exclude_from_amazon_export')}")

# Reset
model['exclude_from_amazon_export'] = False
requests.put(f"{BASE}/models/1", json=model)
print("\nReset to False")
