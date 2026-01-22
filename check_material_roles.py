from app.database import SessionLocal
from app.models.core import MaterialRoleAssignment
from datetime import datetime

db = SessionLocal()
now = datetime.utcnow()

assignments = db.query(MaterialRoleAssignment).filter(
    MaterialRoleAssignment.effective_date <= now,
    (MaterialRoleAssignment.end_date == None) | (MaterialRoleAssignment.end_date > now)
).all()

print("=== Active Material Role Assignments ===")
for a in assignments:
    print(f"Role: '{a.role}'")
    print(f"  -> Material: {a.material.name} (ID: {a.material.id})")
    print()

# Check for required roles
required_roles = [
    "CHOICE_WATERPROOF_FABRIC",
    "PREMIUM_SYNTHETIC_LEATHER", 
    "PADDING"
]

print("=== Required Roles Check ===")
found_roles = {a.role for a in assignments}
for role in required_roles:
    if role in found_roles:
        print(f"✓ {role} - FOUND")
    else:
        print(f"✗ {role} - MISSING")
