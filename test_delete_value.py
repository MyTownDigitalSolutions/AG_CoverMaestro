import requests

# Get field to find UITestDeleteMe
r = requests.get('http://localhost:8000/ebay-templates/4/fields')
action = [f for f in r.json()['fields'] if f['id'] == 35][0]

# Find UITestDeleteMe
test_vals = [v for v in action['allowed_values_detailed'] if v['value'] == 'UITestDeleteMe']

if test_vals:
    test_val = test_vals[0]
    print(f"Found UITestDeleteMe with ID: {test_val['id']}")
    
    # Delete it
    r_del = requests.delete(f"http://localhost:8000/ebay-templates/fields/35/valid-values/{test_val['id']}")
    print(f"Delete status: {r_del.status_code}")
    
    if r_del.status_code == 200:
        data = r_del.json()
        print(f"UITestDeleteMe in result: {'UITestDeleteMe' in data['allowed_values']}")
        print(f"Remaining values: {len(data['allowed_values'])}")
        print("Delete successful!")
    else:
        print("Delete failed:", r_del.text)
else:
    print("UITestDeleteMe not found!")
