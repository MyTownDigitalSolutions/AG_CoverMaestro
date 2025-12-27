import requests
import json

url = "http://localhost:8001/templates"
print(f"Checking {url}...")
try:
    r = requests.get(url)
    print(f"Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"Item count: {len(data)}")
        if len(data) > 0:
            item = data[0]
            print(f"Check keys for new fields:")
            print(f"- export_sheet_name_override: {'export_sheet_name_override' in item}")
            print(f"- export_start_row_override: {'export_start_row_override' in item}")
            print(f"- export_force_exact_start_row: {'export_force_exact_start_row' in item}")
            print(f"Sample value for sheet: {item.get('export_sheet_name_override')}")
            print(f"Sample value for force: {item.get('export_force_exact_start_row')}")
        else:
            print("Empty list returned.")
    else:
        print(f"Error: {r.text}")
except Exception as e:
    print(f"Failed: {e}")
