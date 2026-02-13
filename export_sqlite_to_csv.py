import os
import re
import csv
import sqlite3

DB_PATH = "cover_app.db"
OUT_DIR = "sqlite_export_csv"

SKIP_PATTERNS = [
    r"^_alembic_tmp_",
    r"^sqlite_",
    r"__backup_",
    r"__new$",
]

def should_skip(table: str) -> bool:
    return any(re.search(p, table) for p in SKIP_PATTERNS)

def main():
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"DB not found: {DB_PATH} (run from repo root)")

    os.makedirs(OUT_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    tables = [r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    ).fetchall()]

    exported = []
    skipped = []

    for t in tables:
        if should_skip(t):
            skipped.append(t)
            continue

        rows = cur.execute(f"SELECT * FROM \"{t}\";").fetchall()
        cols = [d[0] for d in cur.description]

        out_path = os.path.join(OUT_DIR, f"{t}.csv")
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(cols)
            w.writerows(rows)

        exported.append((t, len(rows)))

    print(f"\nExported {len(exported)} tables to ./{OUT_DIR}\n")
    for t, n in exported:
        print(f"{t}: {n} rows")
    print("\nSkipped:")
    for t in skipped:
        print(f"  {t}")

if __name__ == "__main__":
    main()
