#!/usr/bin/env python
"""Compare database columns with ORM model columns."""
import sqlite3

# Get actual DB columns
conn = sqlite3.connect('cover_app.db')
cursor = conn.cursor()
cursor.execute('PRAGMA table_info(marketplace_orders)')
db_cols = {c[1] for c in cursor.fetchall()}
conn.close()

# Expected columns from ORM model (from viewing core.py MarketplaceOrder)
orm_cols = {
    'id', 'import_run_id', 'source', 'marketplace', 'external_order_id',
    'external_order_number', 'external_store_id', 'order_date',
    'created_at_external', 'updated_at_external', 'imported_at',
    'last_synced_at', 'status_raw', 'status_normalized', 'buyer_name',
    'buyer_email', 'buyer_phone', 'currency_code', 'items_subtotal_cents',
    'shipping_cents', 'tax_cents', 'discount_cents', 'fees_cents',
    'refunded_cents', 'order_total_cents', 'fulfillment_channel',
    'shipping_service_level', 'ship_by_date', 'deliver_by_date',
    'notes', 'import_error', 'raw_marketplace_data', 'created_at', 'updated_at'
}

print(f"DB columns ({len(db_cols)}):", sorted(db_cols))
print()
print(f"ORM columns ({len(orm_cols)}):", sorted(orm_cols))
print()

missing_in_db = orm_cols - db_cols
extra_in_db = db_cols - orm_cols

if missing_in_db:
    print(f"MISSING IN DB: {sorted(missing_in_db)}")
else:
    print("No columns missing in DB")
    
if extra_in_db:
    print(f"EXTRA IN DB: {sorted(extra_in_db)}")
else:
    print("No extra columns in DB")
