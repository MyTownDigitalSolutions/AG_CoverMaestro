import csv
import os
import sys
import psycopg2

CSV_IN = sys.argv[1]
CSV_OUT = sys.argv[2]
DSN_ENV = sys.argv[3]

dsn = os.environ.get(DSN_ENV)
if not dsn:
    raise SystemExit(f"Missing env var: {DSN_ENV}")

# Make psycopg2 accept SQLAlchemy-style URLs
dsn = dsn.replace("postgresql+psycopg2://", "postgresql://")

conn = psycopg2.connect(dsn)
cur = conn.cursor()
cur.execute("select id from public.models")
valid_ids = {row[0] for row in cur.fetchall()}
conn.close()

with open(CSV_IN, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows_out = []
    skipped = 0

    for r in reader:
        mid = r.get("model_id")
        if mid is None or mid == "":
            skipped += 1
            continue
        try:
            if int(mid) in valid_ids:
                rows_out.append(r)
            else:
                skipped += 1
        except ValueError:
            skipped += 1

with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows_out)

print(f"✅ Wrote {len(rows_out)} rows to {CSV_OUT} (skipped {skipped})")

