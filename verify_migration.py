from app.database import engine
from sqlalchemy import inspect, text

insp = inspect(engine)
cols = insp.get_columns('models')
top_handle_cols = [c for c in cols if 'top_handle' in c['name']]

print('✓ Migration applied successfully!\n')
print('Top Handle columns in models table:')
for c in top_handle_cols:
    print(f"  - {c['name']}: {c['type']} (nullable={c['nullable']})")

with engine.connect() as conn:
    ver = conn.execute(text('SELECT version_num FROM alembic_version')).fetchone()[0]
    print(f'\nCurrent alembic version: {ver}')
