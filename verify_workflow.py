import requests
import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# App setup
sys.path.append(os.getcwd())
try:
    from app.database import SQLALCHEMY_DATABASE_URL
except ImportError:
    # Fallback if imports fail
    SQLALCHEMY_DATABASE_URL = "sqlite:///./cover_app.db"

def run_verification():
    print("--- 1. Backend Connectivity & Data Check ---")
    try:
        engine = create_engine(SQLALCHEMY_DATABASE_URL)
        with engine.connect() as conn:
            # Find a model with variations first
            result = conn.execute(text("SELECT model_id FROM model_variation_skus LIMIT 1"))
            row = result.fetchone()
            if row:
                model_id = row[0]
                print(f"Found Model ID with existing variations: {model_id}")
            else:
                # Fallback to any model
                result = conn.execute(text("SELECT id FROM models LIMIT 1"))
                row = result.fetchone()
                if row:
                    model_id = row[0]
                    print(f"Found Model ID (no variations yet): {model_id}")
                else:
                    print("CRITICAL: No models in database. Cannot test.")
                    return
    except Exception as e:
        print(f"Database connection failed: {e}")
        return

    base_url = "http://127.0.0.1:8000/api"
    
    # --- Step: Load Existing ---
    print(f"\n--- 2. Testing existing variations load (GET /ebay-variations/existing) ---")
    try:
        resp = requests.post(f"{base_url}/ebay-variations/existing", json=[model_id]) # It's a POST in the API definition? verify
        # wait, client code says: await ebayVariationsApi.getExisting(ids)
        # api.ts: getExisting: (ids: number[]) => api.post('/ebay-variations/existing', ids)
        # It's a POST with list of ints.
        
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"Row count: {len(data)}")
        else:
            print(f"Error: {resp.text}")
    except Exception as e:
        print(f"Request failed: {e}")

    # --- Step: Export ---
    print(f"\n--- 3. Testing Export CSV (POST /ebay-export/export) ---")
    export_url = f"{base_url}/ebay-export/export"
    payload = {"model_ids": [model_id]}
    
    try:
        print(f"Requesting: {export_url}")
        print(f"Payload: {payload}")
        resp = requests.post(export_url, json=payload)
        
        print(f"Status Code: {resp.status_code}")
        print("Response Headers:")
        for k, v in resp.headers.items():
            if k.lower() in ['content-disposition', 'content-type', 'content-length']:
                print(f"  {k}: {v}")
                
        if resp.status_code == 200:
            content = resp.content.decode('utf-8-sig')
            lines = content.splitlines()
            print(f"\nCSV Preview (First 10 lines):")
            print("-" * 40)
            for line in lines[:10]:
                print(line)
            print("-" * 40)
            
            # Validation
            has_rel_details = "Relationship details" in lines[0] if lines else False
            print(f"\nValidation:")
            print(f"  - 'Relationship details' column present: {has_rel_details}")
            print(f"  - Total rows: {len(lines)}")
        else:
            print(f"Export Failed: {resp.text}")
            
    except Exception as e:
        print(f"Export request failed: {e}")

if __name__ == "__main__":
    run_verification()
