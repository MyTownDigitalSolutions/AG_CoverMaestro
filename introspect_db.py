#!/usr/bin/env python
"""Introspect database schema for marketplace tables."""
import sqlite3

conn = sqlite3.connect('cover_app.db')
cursor = conn.cursor()

tables = [
    'marketplace_orders',
    'marketplace_import_runs', 
    'marketplace_order_addresses',
    'marketplace_order_lines',
    'marketplace_order_shipments'
]

for table in tables:
    print(f"=== {table} ===")
    try:
        cursor.execute(f'PRAGMA table_info({table})')
        cols = cursor.fetchall()
        for c in cols:
            # (cid, name, type, notnull, dflt_value, pk)
            print(f"  {c[1]}: {c[2]} (notnull={c[3]}, default={c[4]}, pk={c[5]})")
    except Exception as e:
        print(f"  ERROR: {e}")
    print()

conn.close()
