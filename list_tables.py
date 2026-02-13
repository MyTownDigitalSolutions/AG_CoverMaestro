import sqlite3

conn = sqlite3.connect("cover_app.db")
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
for row in cur.fetchall():
    print(row[0])
