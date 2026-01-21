import sqlite3
conn = sqlite3.connect('cover_app.db')
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='marketplace_credentials'")
result = cursor.fetchone()
print(f"marketplace_credentials table exists: {result is not None}")
conn.close()
