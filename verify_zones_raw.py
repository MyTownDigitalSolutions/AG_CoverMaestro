import sqlite3

def verify_zones_raw():
    conn = sqlite3.connect('cover_app.db')
    cursor = conn.cursor()
    cursor.execute("SELECT code FROM shipping_zones")
    rows = cursor.fetchall()
    print(f"Zones in DB: {[r[0] for r in rows]}")
    print(f"Count of zones from DB: {len(rows)}")
    conn.close()

if __name__ == "__main__":
    verify_zones_raw()
