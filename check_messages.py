import sqlite3

conn = sqlite3.connect("cover_app.db")
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM marketplace_messages WHERE external_message_id LIKE 'synthetic:%'")
print("synthetic:", cur.fetchone()[0])

cur.execute("""
SELECT COUNT(*)
FROM marketplace_messages
WHERE external_message_id IS NULL
   OR external_message_id = ''
   OR external_message_id = 'None'
""")
print("bad ids:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM marketplace_messages")
print("total:", cur.fetchone()[0])
