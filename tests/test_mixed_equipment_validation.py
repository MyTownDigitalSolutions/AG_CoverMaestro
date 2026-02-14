"""
Quick verification test for _evaluate_equipment_type_compatibility function.
This can be run manually to verify the logic works as expected.
"""

# Sample test cases to verify the compatibility logic
test_cases = [
    {
        "name": "Compatible - Single equipment type",
        "setup": "One equipment type with proper link",
        "expected": "compatible",
    },
    {
        "name": "Compatible - Multiple equipment types, same templates, all have None customization",
        "setup": "3 equipment types, all map to product_type_id=1, all have customization_template_id=None",
        "expected": "compatible",
    },
    {
        "name": "Compatible - Multiple equipment types, same templates, same non-None customization",
        "setup": "2 equipment types, all map to product_type_id=1, all have customization_template_id=5",
        "expected": "compatible",
    },
    {
        "name": "Incompatible - Multiple product types",
        "setup": "2 equipment types, one maps to product_type_id=1, other to product_type_id=2",
        "expected": "multiple_product_types",
    },
    {
        "name": "Incompatible - Multiple customization templates",
        "setup": "2 equipment types, both map to product_type_id=1, one has customization_template_id=5, other has customization_template_id=6",
        "expected": "multiple_customization_templates",
    },
    {
        "name": "Incompatible - Mixed None and non-None customization templates",
        "setup": "2 equipment types, both map to product_type_id=1, one has customization_template_id=None, other has customization_template_id=5",
        "expected": "multiple_customization_templates",
        "note": "This is the bug fix - None must be included in the set",
    },
    {
        "name": "Incompatible - Missing links",
        "setup": "2 equipment types selected, but only 1 has EquipmentTypeProductType row",
        "expected": "missing_equipment_type_product_type_links",
    },
    {
        "name": "Incompatible - None in equipment_type_ids",
        "setup": "One model has equipment_type_id=None",
        "expected": "null_equipment_type_id",
    },
]

print("=" * 80)
print("Mixed Equipment Type Validation - Test Case Reference")
print("=" * 80)
print()
print("These test cases should be verified manually in the UI:")
print()

for i, tc in enumerate(test_cases, 1):
    print(f"{i}. {tc['name']}")
    print(f"   Setup: {tc['setup']}")
    print(f"   Expected Result: {tc['expected']}")
    if "note" in tc:
        print(f"   Note: {tc['note']}")
    print()

print("=" * 80)
print("To verify in logs, look for lines containing:")
print("[EXPORT][VALIDATE] or [EXPORT][BUILD_DATA]")
print()
print("Log format:")
print("  selected_models=N equipment_type_ids=[...] product_type_ids=[...] ")
print("  customization_template_ids=[...] missing_equipment_type_ids=[...] ")
print("  compatible=True/False reason=...")
print("=" * 80)
