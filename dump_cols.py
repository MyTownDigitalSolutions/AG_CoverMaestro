import sqlite3
import json

conn = sqlite3.connect('cover_app.db')
cursor = conn.cursor()

# Get columns for marketplace_orders
cursor.execute('PRAGMA table_info(marketplace_orders)')
cols = cursor.fetchall()

db_columns = {}
for c in cols:
    col_name = c[1]
    col_type = c[2]
    notnull = c[3]
    default = c[4]
    pk = c[5]
    db_columns[col_name] = {
        'type': col_type,
        'notnull': bool(notnull),
        'default': default,
        'pk': bool(pk)
    }

# Write to file for viewing
with open('db_columns.json', 'w') as f:
    json.dump(db_columns, f, indent=2)

print(f"Written {len(db_columns)} columns to db_columns.json")
print("Columns:", list(db_columns.keys()))
conn.close()
