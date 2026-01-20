#!/usr/bin/env python
"""Test imports to diagnose SQLAlchemy mapper issue."""
import traceback

try:
    print("Step 1: Import templates...")
    from app.models import templates
    print("  OK")
    
    print("Step 2: Import core MarketplaceOrder...")
    from app.models.core import MarketplaceOrder
    print("  OK")
    
    print("Step 3: Create session...")
    from app.database import SessionLocal
    db = SessionLocal()
    print("  OK")
    
    print("Step 4: Query count...")
    count = db.query(MarketplaceOrder).count()
    print(f"  OK - Count: {count}")
    
    db.close()
    print("\nAll imports successful!")
    
except Exception as e:
    print(f"\nERROR at step: {e}")
    traceback.print_exc()
