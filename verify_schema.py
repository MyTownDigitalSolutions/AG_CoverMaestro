import requests
import json

try:
    r = requests.get("http://localhost:8001/settings/amazon-customization-templates")
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            item = data[0]
            print(f"Has export_sheet_name_override? {'export_sheet_name_override' in item}")
            print(f"Has export_start_row_override? {'export_start_row_override' in item}")
            print(f"Has export_force_exact_start_row? {'export_force_exact_start_row' in item}")
            print(f"Sample keys: {list(item.keys())}")
        else:
            print(f"Response is empty list or not list: {type(data)}")
    else:
        print(f"Error: {r.text}")
except Exception as e:
    print(f"Failed: {e}")
