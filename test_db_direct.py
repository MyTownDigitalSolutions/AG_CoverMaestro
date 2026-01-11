import sqlite3

conn = sqlite3.connect('cover_app.db')
c = conn.cursor()

# Check a specific model
c.execute("SELECT id, name, exclude_from_amazon_export, exclude_from_ebay_export FROM models LIMIT 1")
row = c.fetchone()
print(f"Sample row: ID={row[0]}, name={row[1]}, amazon={row[2]}, ebay={row[3]}")

# Try updating one
c.execute("UPDATE models SET exclude_from_amazon_export = 1 WHERE id = ?", (row[0],))
conn.commit()

# Verify
c.execute("SELECT id, name, exclude_from_amazon_export FROM models WHERE id = ?", (row[0],))
updated = c.fetchone()
print(f"After update: ID={updated[0]}, name={updated[1]}, exclude_amazon={updated[2]}")

# Reset
c.execute("UPDATE models SET exclude_from_amazon_export = 0 WHERE id = ?", (row[0],))
conn.commit()
print("Reset to 0")

conn.close()
