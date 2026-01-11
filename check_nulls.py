import sqlite3
conn = sqlite3.connect('cover_app.db')
c = conn.cursor()
c.execute("SELECT count(*) FROM models WHERE exclude_from_etsy_export IS NULL OR exclude_from_amazon_export IS NULL")
print("Null flags:", c.fetchone()[0])
conn.close()
