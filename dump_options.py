import requests
import json

r = requests.get('http://localhost:8000/equipment-types/1/design-options')
opts = r.json()

with open('design_options_output.json', 'w') as f:
    json.dump(opts, f, indent=2)

print(f'Saved {len(opts)} design options to design_options_output.json')
print('\nHandle Location Options:')
for o in opts:
    if o['option_type'] == 'handle_location':
        print(f'  ID {o["id"]}: {o["name"]} - Assigned to: {o.get("equipment_type_ids", [])}')

print('\nText Options (handle-related):')
for o in opts:
    if o['option_type'] == 'text_option' and 'handle' in o['name'].lower():
        print(f'  ID {o["id"]}: {o["name"]} - Assigned to: {o.get("equipment_type_ids", [])}')
