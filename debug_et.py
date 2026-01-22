
from sqlalchemy import create_engine, text

DB_URL = "sqlite:///./ag_cover_maestro.db"
engine = create_engine(DB_URL)

try:
    with engine.connect() as conn:
        print("--- Equipment Types ---")
        result = conn.execute(text("SELECT id, name, reverb_template_id FROM equipment_types"))
        rows = result.fetchall()
        for r in rows:
            print(f"ID: {r.id}, Name: {r.name}, Reverb Tpl ID: {r.reverb_template_id}")
            
except Exception as e:
    print(f"Error: {e}")
