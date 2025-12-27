from app.database import engine
from sqlalchemy import text

with engine.begin() as conn:
    conn.execute(text('DELETE FROM alembic_version'))
    conn.execute(text("INSERT INTO alembic_version VALUES ('d1256fecefa1')"))
    print('Reset alembic_version to d1256fecefa1')
