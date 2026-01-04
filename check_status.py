import sqlite3
import os

def check():
    if not os.path.exists('cover_app.db'):
        print("DB not found")
        return

    conn = sqlite3.connect('cover_app.db')
    c = conn.cursor()
    
    # Check model_notes
    c.execute("PRAGMA table_info(models)")
    model_cols = [r[1] for r in c.fetchall()]
    print(f"model_notes exists: {'model_notes' in model_cols}")
    
    # Check table equipment_type_customization_templates
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='equipment_type_customization_templates'")
    table_exists = c.fetchone() is not None
    print(f"join table exists: {table_exists}")
    
    conn.close()

if __name__ == "__main__":
    check()
