import os
import csv
import sys
csv.field_size_limit(sys.maxsize)


import psycopg2
from psycopg2.extras import execute_values

# Usage:
#   python bulk_import_csv.py sqlite_export_csv/amazon_product_types.csv public.amazon_product_types MIGRATION_DATABASE_URL

CSV_PATH = sys.argv[1]
TABLE = sys.argv[2]
URL_ENV = sys.argv[3]  # e.g. MIGRATION_DATABASE_URL

dsn = os.getenv(URL_ENV)
if not dsn:
    raise SystemExit(f"Missing env var: {URL_ENV}")

# Make psycopg2 accept SQLAlchemy-style URLs
dsn = dsn.replace("postgresql+psycopg2://", "postgresql://")

BATCH = 2000

def main():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames
        if not cols:
            raise SystemExit("CSV has no header / columns")

        rows = []
        for r in reader:
            rows.append([r.get(c) if r.get(c) != "" else None for c in cols])

    print(f"Read {len(rows)} rows from {CSV_PATH}")
    print(f"Columns: {cols}")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            # TRUNCATE for clean import (safe for dev; you asked for bulk)
            cur.execute(f"TRUNCATE TABLE {TABLE} RESTART IDENTITY CASCADE;")

            template = "(" + ",".join(["%s"] * len(cols)) + ")"
            col_sql = ",".join([f'"{c}"' for c in cols])

            for i in range(0, len(rows), BATCH):
                chunk = rows[i:i+BATCH]
                execute_values(
                    cur,
                    f'INSERT INTO {TABLE} ({col_sql}) VALUES %s',
                    chunk,
                    template=template,
                    page_size=BATCH
                )
                print(f"Inserted {min(i+BATCH, len(rows))}/{len(rows)}")

        conn.commit()
        print("✅ Import complete")
    except Exception as e:
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
