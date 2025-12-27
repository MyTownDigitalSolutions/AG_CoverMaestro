from app.database import engine
from sqlalchemy import text, inspect

def verify():
    insp = inspect(engine)
    tables = insp.get_table_names()
    
    template_tables = [t for t in tables if "template" in t or "product_type" in t]
    print(f"Found template-related tables: {template_tables}")
    
    # Check amazon_customization_templates columns
    target_table = "amazon_customization_templates"
    if target_table in tables:
        cols = [c['name'] for c in insp.get_columns(target_table)]
        print(f"Columns in {target_table}: {cols}")
        if "equipment_type_id" not in cols:
            print(f"WARNING: {target_table} does NOT have equipment_type_id column.")
    else:
        print(f"Table {target_table} does not exist.")

    # Check equipment_type_product_types columns
    link_table = "equipment_type_product_types"
    if link_table in tables:
        cols = [c['name'] for c in insp.get_columns(link_table)]
        print(f"Columns in {link_table}: {cols}")
        
        # Run verification query on link table (where I applied constraint)
        print(f"Verifying duplicates in {link_table}...")
        with engine.connect() as conn:
            query = text(f"""
                SELECT equipment_type_id, COUNT(*) AS cnt
                FROM {link_table}
                WHERE equipment_type_id IS NOT NULL
                GROUP BY equipment_type_id
                HAVING COUNT(*) > 1;
            """)
            rows = conn.execute(query).fetchall()
            if not rows:
                print(f"PASS: 0 duplicate equipment_type_id rows in {link_table}")
            else:
                print(f"FAIL: Found duplicates in {link_table}: {rows}")
                
    else:
        print(f"Table {link_table} does not exist.")

if __name__ == "__main__":
    verify()
