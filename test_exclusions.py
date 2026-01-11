"""
Test script to verify export exclusion flags work end-to-end.
Run this after starting the backend server.
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_export_exclusions():
    print("=" * 80)
    print("TESTING EXPORT EXCLUSION FLAGS")
    print("=" * 80)
    
    # Step 1: Get first model
    print("\n1. Fetching models...")
    response = requests.get(f"{BASE_URL}/models")
    models = response.json()
    
    if not models:
        print("ERROR: No models found in database")
        return
    
    model = models[0]
    model_id = model['id']
    print(f"   Using model ID {model_id}: {model['name']}")
    print(f"   Current exclude_from_amazon_export: {model.get('exclude_from_amazon_export', 'NOT IN RESPONSE')}")
    
    # Step 2: Update model to exclude from Amazon
    print("\n2. Setting exclude_from_amazon_export = True...")
    update_data = {
        **model,
        "exclude_from_amazon_export": True,
        "exclude_from_ebay_export": False,
        "exclude_from_reverb_export": False,
        "exclude_from_etsy_export": False
    }
    
    response = requests.put(f"{BASE_URL}/models/{model_id}", json=update_data)
    if response.status_code != 200:
        print(f"   ERROR: Update failed with status {response.status_code}")
        print(f"   Response: {response.text}")
        return
    
    updated_model = response.json()
    print(f"   Response exclude_from_amazon_export: {updated_model.get('exclude_from_amazon_export', 'NOT IN RESPONSE')}")
    
    # Step 3: Verify by fetching the model again
    print("\n3. Fetching model again to verify persistence...")
    response = requests.get(f"{BASE_URL}/models/{model_id}")
    refetched_model = response.json()
    print(f"   exclude_from_amazon_export: {refetched_model.get('exclude_from_amazon_export', 'NOT IN RESPONSE')}")
    
    # Step 4: Test export filtering
    print("\n4. Testing export filtering...")
    export_request = {
        "model_ids": [model_id],
        "listing_type": "individual"
    }
    
    # Try to build export data (should exclude this model)
    response = requests.post(f"{BASE_URL}/export/validate", json=export_request)
    if response.status_code == 200:
        validation = response.json()
        print(f"   Validation response: {json.dumps(validation, indent=2)}")
    
    # Step 5: Reset flag
    print("\n5. Resetting exclude_from_amazon_export = False...")
    update_data['exclude_from_amazon_export'] = False
    response = requests.put(f"{BASE_URL}/models/{model_id}", json=update_data)
    if response.status_code == 200:
        final_model = response.json()
        print(f"   Final exclude_from_amazon_export: {final_model.get('exclude_from_amazon_export', 'NOT IN RESPONSE')}")
    
    print("\n" + "=" * 80)
    print("TEST COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    try:
        test_export_exclusions()
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
