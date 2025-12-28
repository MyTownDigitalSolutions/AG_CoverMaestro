import requests
import json

# Test the actual backend endpoints
base_url = "http://localhost:8000"

# 1. List equipment types
try:
    r = requests.get(f"{base_url}/api/equipment-types")
    print(f"Status: {r.status_code}")
    equipment_types = r.json()
    print(f"\nEquipment Types ({len(equipment_types)}):")
    for et in equipment_types:
        print(f"  ID {et['id']}: {et['name']}")
    
    # Find Guitar Amplifier
    guitar_amp_id = next((et['id'] for et in equipment_types if 'guitar' in et['name'].lower() and 'ampl' in et['name'].lower()), None)
    
    if guitar_amp_id:
        print(f"\n=== Guitar Amplifier ID: {guitar_amp_id} ===")
        
        # 2. Get design options for Guitar Amplifier
        r2 = requests.get(f"{base_url}/api/equipment-types/{guitar_amp_id}/design-options")
        print(f"\nDesign Options API Status: {r2.status_code}")
        design_options = r2.json()
        print(f"Design Options Count: {len(design_options)}")
        print(json.dumps(design_options, indent=2))
        
    else:
        print("\nGuitar Amplifier not found!")
        
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
