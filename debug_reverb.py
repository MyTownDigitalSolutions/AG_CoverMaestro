
from sqlalchemy import create_engine, text
import os

DB_URL = "sqlite:///./ag_cover_maestro.db"
engine = create_engine(DB_URL)

with engine.connect() as conn:
    print("--- Models ---")
    result = conn.execute(text("SELECT id, name, equipment_type_id FROM models WHERE name LIKE '%Hot Rod Deluxe%'"))
    models = result.fetchall()
    for m in models:
        print(f"Model: {m}")
        
    if models:
        et_id = models[0].equipment_type_id
        print(f"\n--- Equipment Type ID: {et_id} ---")
        result = conn.execute(text(f"SELECT id, name, reverb_template_id FROM equipment_types WHERE id = {et_id}"))
        et = result.fetchone()
        print(f"Equipment Type: {et}")
        
        if et and et.reverb_template_id:
             print(f"\n--- Reverb Template ID: {et.reverb_template_id} ---")
             result = conn.execute(text(f"SELECT id, original_filename FROM reverb_templates WHERE id = {et.reverb_template_id}"))
             tpl = result.fetchone()
             print(f"Template: {tpl}")
        else:
             print("\n!!! NO REVERB TEMPLATE ASSIGNED !!!")

