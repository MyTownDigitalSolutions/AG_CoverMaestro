#!/usr/bin/env python
"""Quick test script to debug marketplace orders endpoint."""
import traceback
from datetime import datetime

try:
    from app.database import SessionLocal
    from app.models.core import MarketplaceOrder
    from app.models.enums import OrderSource, NormalizedOrderStatus, Marketplace
    
    db = SessionLocal()
    
    # Test 1: Check if table exists by querying
    print("Querying existing orders...")
    existing = db.query(MarketplaceOrder).count()
    print(f"Existing orders count: {existing}")
    
    # Test 2: Try to create a simple order
    print("\nCreating test order...")
    order = MarketplaceOrder(
        source=OrderSource.API_IMPORT,
        marketplace=Marketplace.AMAZON,
        external_order_id=f"TEST-{datetime.utcnow().timestamp()}",
        order_date=datetime.utcnow(),
        imported_at=datetime.utcnow(),
        status_normalized=NormalizedOrderStatus.PROCESSING,
        currency_code="USD"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    print(f"Created order id={order.id}")
    
    # Clean up
    db.delete(order)
    db.commit()
    print("Cleaned up test order")
    
    db.close()
    print("\nAll tests passed!")
    
except Exception as e:
    print(f"ERROR: {e}")
    traceback.print_exc()
