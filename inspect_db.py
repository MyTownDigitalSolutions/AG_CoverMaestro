from app.database import SessionLocal, engine
from sqlalchemy import inspect

inspector = inspect(engine)
columns = [c['name'] for c in inspector.get_columns('equipment_types')]
print(f"Columns in equipment_types: {columns}")

if 'reverb_template_id' in columns:
    print("reverb_template_id exists")
else:
    print("reverb_template_id MISSING")
