import sqlite3

conn = sqlite3.connect('cover_app.db')
cursor = conn.cursor()

# Add the columns
try:
    cursor.execute('ALTER TABLE models ADD COLUMN exclude_from_amazon_export BOOLEAN NOT NULL DEFAULT 0')
    print("Added exclude_from_amazon_export column")
except Exception as e:
    print(f"Error adding exclude_from_amazon_export: {e}")

try:
    cursor.execute('ALTER TABLE models ADD COLUMN exclude_from_ebay_export BOOLEAN NOT NULL DEFAULT 0')
    print("Added exclude_from_ebay_export column")
except Exception as e:
    print(f"Error adding exclude_from_ebay_export: {e}")

conn.commit()
conn.close()
print("Done!")
