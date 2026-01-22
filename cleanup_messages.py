import sqlite3

conn = sqlite3.connect("cover_app.db")
cur = conn.cursor()

cur.execute(
    "DELETE FROM marketplace_messages WHERE external_message_id LIKE 'synthetic:%'"
)

conn.commit()
print("deleted synthetic rows:", cur.rowcount)
