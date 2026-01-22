import sqlite3
conn = sqlite3.connect('cover_app.db')
cursor = conn.cursor()
cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='marketplace_orders'")
result = cursor.fetchone()
if result:
    print(result[0])
else:
    print("Table not found")
conn.close()
