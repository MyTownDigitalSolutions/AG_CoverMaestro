import sqlite3

def add_columns():
    conn = sqlite3.connect('cover_app.db')
    cursor = conn.cursor()
    
    columns = [
        ('exclude_from_amazon_export', 'BOOLEAN DEFAULT 0'),
        ('exclude_from_ebay_export', 'BOOLEAN DEFAULT 0'),
        ('exclude_from_reverb_export', 'BOOLEAN DEFAULT 0'),
        ('exclude_from_etsy_export', 'BOOLEAN DEFAULT 0')
    ]
    
    for col_name, col_type in columns:
        try:
            # Check if column exists first to be cleaner, though catch is fine
            cursor.execute(f"ALTER TABLE models ADD COLUMN {col_name} {col_type}")
            print(f"Added column {col_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column {col_name} already exists")
            else:
                print(f"Error adding {col_name}: {e}")
                
    conn.commit()
    conn.close()

if __name__ == "__main__":
    add_columns()
