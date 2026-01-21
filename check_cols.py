"""Check marketplace_orders table columns."""
import sqlite3
conn = sqlite3.connect('cover_app.db')
cursor = conn.cursor()
cursor.execute("PRAGMA table_info(marketplace_orders)")
cols = cursor.fetchall()
with open('cols_output.txt', 'w') as f:
    f.write("marketplace_orders columns:\n")
    for col in cols:
        f.write(f"  {col[1]}: {col[2]} (notnull={col[3]}, pk={col[5]})\n")
print("Saved to cols_output.txt")
conn.close()
