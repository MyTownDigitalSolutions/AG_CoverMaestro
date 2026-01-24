import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000/api"

def test_api():
    model_id = 168
    
    print(f"--- Step 1: Force Recalc for Model {model_id} via API ---")
    # Simulate Frontend Button Click
    # Frontend calls recalculateBaselines({ model_ids: [id] }) -> only_if_stale defaults to True (via API schema default)
    # But wait, does frontend send only_if_stale? 
    # In api.ts interface RecalcRequest: only_if_stale is optional.
    # So if not sent, backend uses default = True.
    
    payload = {
        "model_ids": [model_id],
        "only_if_stale": True # mimicking default
    }
    
    try:
        res = requests.post(f"{BASE_URL}/pricing/recalculate", json=payload)
        print(f"Recalc Status: {res.status_code}")
        print(f"Recalc Response: {res.text}")
    except Exception as e:
        print(f"Recalc Request Failed: {e}")
        return

    print(f"\n--- Step 2: Fetch Reverb Snapshots via API ---")
    try:
        res = requests.get(f"{BASE_URL}/models/{model_id}/pricing/snapshots", params={"marketplace": "reverb"})
        print(f"Snapshots Status: {res.status_code}")
        data = res.json()
        print(f"Snapshots Count: {len(data)}")
        for s in data:
            print(f" - {s.get('variant_key')}: {s.get('retail_price_cents')}")
    except Exception as e:
        print(f"Snapshots Fetch Failed: {e}")

if __name__ == "__main__":
    test_api()
