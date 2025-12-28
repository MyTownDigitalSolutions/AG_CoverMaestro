import requests

# Get all equipment types
r = requests.get('http://localhost:8000/api/equipment-types')
equipment_types = r.json()
print(f'Equipment Types: {len(equipment_types)}')
for et in equipment_types:
    print(f'  {et["id"]}: {et["name"]}')

# Find Guitar Amplifier
guitar_amp = next((e for e in equipment_types if 'guitar' in e['name'].lower() and 'ampl' in e['name'].lower()), None)
if guitar_amp:
    print(f'\n=== Guitar Amplifier (ID {guitar_amp["id"]}) ===')
    
    # Get design options for this equipment type
    r = requests.get(f'http://localhost:8000/api/equipment-types/{guitar_amp["id"]}/design-options')
    design_options = r.json()
    print(f'Assigned Design Options: {len(design_options)}')
    
    print('\nHandle Location Options:')
    for opt in design_options:
        if opt['option_type'] == 'handle_location':
            print(f'  - {opt["name"]} (ID: {opt["id"]})')
    
    print('\nText Options (handle-related):')
    for opt in design_options:
        if opt['option_type'] == 'text_option' and 'handle' in opt['name'].lower():
            print(f'  - {opt["name"]} (ID: {opt["id"]})')
else:
    print('Guitar Amplifier not found')

# Get all design options
r = requests.get('http://localhost:8000/api/design-options')
all_options = r.json()
print(f'\n=== ALL Design Options (Total: {len(all_options)}) ===')
print('\nHandle Location type:')
for opt in all_options:
    if opt['option_type'] == 'handle_location':
        print(f'  - {opt["name"]} (ID: {opt["id"]}, Assigned to: {opt.get("equipment_type_ids", [])})')

print('\nText Options with "handle":')
for opt in all_options:
    if opt['option_type'] == 'text_option' and 'handle' in opt['name'].lower():
        print(f'  - {opt["name"]} (ID: {opt["id"]}, Assigned to: {opt.get("equipment_type_ids", [])})')
