import sqlite3
import os

db_path = "cover_app.db"
print(f"DB Path: {os.path.abspath(db_path)}")

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("\n--- Query A: Model 3 Info ---")
eq_id = None
try:
    cursor.execute("""
       SELECT m.id AS model_id, m.name, m.equipment_type_id, et.name AS equipment_type_name
       FROM models m
       JOIN equipment_types et ON et.id = m.equipment_type_id
       WHERE m.id = 3;
    """)
    row = cursor.fetchone()
    if row:
        print(dict(row))
        eq_id = row['equipment_type_id']
    else:
        print("Model 3 not found.")
except Exception as e:
    print(f"Error Query A: {e}")

if eq_id is not None:
    print(f"\n--- Query B: Links for EqType {eq_id} ---")
    try:
        # Check if 'code' or 'product_type_code' column exists in amazon_product_types ?
        # Assuming 'code' based on previous reads.
        cursor.execute(f"""
           SELECT etpt.equipment_type_id, et.name AS equipment_type_name,
                  etpt.product_type_id, apt.code
           FROM equipment_type_product_types etpt
           JOIN equipment_types et ON et.id = etpt.equipment_type_id
           JOIN amazon_product_types apt ON apt.id = etpt.product_type_id
           WHERE etpt.equipment_type_id = {eq_id};
        """)
        rows = cursor.fetchall()
        if not rows:
             print("No links found.")
        for r in rows:
            print(dict(r))
    except Exception as e:
        print(f"Error Query B: {e}")
else:
    print("Skipping Query B (No EqID)")

print("\n--- Query C: Tables with file_path ---")
try:
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND sql LIKE '%file_path%';")
    tables = [r['name'] for r in cursor.fetchall()]
    print(f"Tables with file_path: {tables}")
    
    for t in tables:
        print(f"\n--- Table: {t} (Last 10) ---")
        try:
            # Check cols
            cursor.execute(f"PRAGMA table_info({t})")
            cols_info = cursor.fetchall()
            cols = [c['name'] for c in cols_info]
            # print(f"Columns: {cols}")
            
            select_cols = []
            possible = ['id', 'original_filename', 'file_path', 'upload_date', 'file_size']
            for c in possible:
                if c in cols:
                    select_cols.append(c)
            
            if select_cols:
                q = f"SELECT {', '.join(select_cols)} FROM {t} ORDER BY id DESC LIMIT 10"
                cursor.execute(q)
                rows = cursor.fetchall()
                if not rows:
                    print("No rows found.")
                for r in rows:
                    print(dict(r))
            else:
                print("None of the target columns found.")
        except Exception as e:
            print(f"Error querying {t}: {e}")

except Exception as e:
    print(f"Error Query C: {e}")

conn.close()
