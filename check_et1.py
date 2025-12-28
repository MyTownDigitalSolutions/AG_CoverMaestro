import requests
import json

r = requests.get('http://localhost:8000/equipment-types/1/design-options')
print(f'Status: {r.status_code}')
opts = r.json()
print(f'Design Options Count: {len(opts)}')
print('\nAll Design Options for Guitar Amplifier (ID 1):')
for o in opts:
    print(f'  - {o["name"]} ({o["option_type"]}) - Assigned to equipment types: {o.get("equipment_type_ids", [])}')
