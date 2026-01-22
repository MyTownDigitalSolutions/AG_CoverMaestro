import sqlite3

conn = sqlite3.connect("cover_app.db")
cur = conn.cursor()

print("=== CREATE TABLE SQL ===")
cur.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='marketplace_orders';")
row = cur.fetchone()
print(row[0] if row else "TABLE NOT FOUND")

print("\n=== PRAGMA table_info ===")
cur.execute("PRAGMA table_info(marketplace_orders);")
for r in cur.fetchall():
    print(r)

conn.close()
