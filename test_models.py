#!/usr/bin/env python
"""Test model imports to verify fix."""
import sys
import traceback

try:
    print("Step 1: Import models package...")
    from app import models
    print("  OK")
    
    print("Step 2: Import MarketplaceOrder from core...")
    from app.models.core import MarketplaceOrder
    print("  OK")
    
    print("Step 3: Import SessionLocal...")
    from app.database import SessionLocal
    print("  OK")
    
    print("Step 4: Create session and query...")
    db = SessionLocal()
    count = db.query(MarketplaceOrder).count()
    db.close()
    print(f"  OK - Order count: {count}")
    
    print("\n✓ All tests passed!")
    
except Exception as e:
    print(f"\n✗ ERROR: {e}")
    traceback.print_exc()
    sys.exit(1)
