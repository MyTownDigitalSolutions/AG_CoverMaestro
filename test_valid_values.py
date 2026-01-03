import requests
import json

# Get field to see current values
r = requests.get('http://localhost:8000/ebay-templates/4/fields')
action = [f for f in r.json()['fields'] if f['id'] == 35][0]
print("Current values:", action['allowed_values'])

# Add TestValue2
r = requests.post('http://localhost:8000/ebay-templates/fields/35/valid-values', json={'value': 'TestValue2'})
print("\n After adding TestValue2:")
print("Status:", r.status_code)
data = r.json()
print("Values:", data['allowed_values'])

# Try to find and delete TestValue (assume ID 140 or iterate)
# For now, just verify it's there
print("\nTestValue is in list:", 'TestValue' in data['allowed_values'])
print("TestValue2 is in list:", 'TestValue2' in data['allowed_values'])

# Set selected_value to TestValue2
r = requests.patch('http://localhost:8000/ebay-templates/fields/35', json={'selected_value': 'TestValue2'})
print("\nAfter selecting TestValue2:")
print("Status:", r.status_code)
data = r.json()
print("Selected value:", data['selected_value'])

# Try deleting with guessed IDs (values are likely sequential)
for value_id in range(135, 145):
    r = requests.delete(f'http://localhost:8000/ebay-templates/fields/35/valid-values/{value_id}')
    if r.status_code == 200:
        data = r.json()
        print(f"\nSuccessfully deleted value_id {value_id}")
        print("Remaining values:", data['allowed_values'])
        print("Selected value after delete:", data['selected_value'])
        break
    elif r.status_code != 404:
        print(f"Unexpected status for ID {value_id}: {r.status_code}")
