import requests
try:
    r = requests.get("http://localhost:8001/models")
    if r.status_code == 200:
        models = r.json()
        for m in models:
            print(f"ID: {m['id']} Name: {m['name']} Equip: {m['equipment_type_id']}")
    else:
        print(f"Failed: {r.status_code}")
except Exception as e:
    print(e)
