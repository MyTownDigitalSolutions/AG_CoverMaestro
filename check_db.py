import sqlite3
conn = sqlite3.connect('cover_app.db')
c = conn.cursor()
c.execute("PRAGMA table_info(models)")
cols = [r[1] for r in c.fetchall()]
print("Columns in models:", cols)
conn.close()
