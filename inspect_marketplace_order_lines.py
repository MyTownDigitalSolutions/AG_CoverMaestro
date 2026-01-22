import sqlite3

DB_PATH = "cover_app.db"
TABLE = "marketplace_order_lines"

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

print("=== CREATE TABLE SQL ===")
cur.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name=?;",
    (TABLE,)
)
row = cur.fetchone()
print(row[0] if row else "TABLE NOT FOUND")

print("\n=== PRAGMA table_info ===")
cur.execute(f"PRAGMA table_info({TABLE});")
cols = cur.fetchall()
for c in cols:
    # (cid, name, type, notnull, dflt_value, pk)
    print(c)

print("\n=== Column names only ===")
print([c[1] for c in cols])

conn.close()
