import requests

# Test basic API access
response = requests.get("http://localhost:8000/models")
print(f"Status: {response.status_code}")

if response.status_code == 200:
    models = response.json()
    print(f"Total models: {len(models)}")
    if models:
        m = models[0]
        print(f"First model: ID={m['id']}, name={m['name']}")
        print(f"  exclude_from_amazon_export: {m.get('exclude_from_amazon_export', 'MISSING')}")
        print(f"  exclude_from_ebay_export: {m.get('exclude_from_ebay_export', 'MISSING')}")
else:
    print(f"Error: {response.text}")
