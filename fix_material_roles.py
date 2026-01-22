"""Check and populate material role assignments if missing"""
from app.database import SessionLocal
from app.models.core import MaterialRoleAssignment, Material
from datetime import datetime

db = SessionLocal()

# Check what roles currently exist
existing_assignments = db.query(MaterialRoleAssignment).filter(
    (MaterialRoleAssignment.end_date == None) | (MaterialRoleAssignment.end_date > datetime.utcnow())
).all()

print("=== Current Active Material Role Assignments ===")
if existing_assignments:
    for a in existing_assignments:
        print(f"Role: '{a.role}' -> Material: {a.material.name} (ID: {a.material.id})")
else:
    print("NO ACTIVE ASSIGNMENTS FOUND!")

print("\n=== Required Roles ===")
required_roles = {
    "CHOICE_WATERPROOF_FABRIC": "Cordura HP",
    "PREMIUM_SYNTHETIC_LEATHER": "Denali Automotive Vinyl",
    "PADDING": "Liberty Headliner"
}

existing_roles = {a.role for a in existing_assignments}

for role, material_hint in required_roles.items():
    if role in existing_roles:
        print(f"✓ {role} - exists")
    else:
        print(f"✗ {role} - MISSING, need to assign '{material_hint}'")
        
        # Try to find and assign the material
        mat = db.query(Material).filter(Material.name.ilike(f"%{material_hint}%")).first()
        if mat:
            print(f"  Found material: {mat.name} (ID: {mat.id})")
            print(f"  Creating assignment...")
            assignment = MaterialRoleAssignment(
                role=role,
                material_id=mat.id,
                effective_date=datetime.utcnow()
            )
            db.add(assignment)
            print(f"  ✓ Created assignment for {role}")
        else:
            print(f"  ✗ ERROR: Could not find material matching '{material_hint}'")

db.commit()
print("\n=== Done ===")
