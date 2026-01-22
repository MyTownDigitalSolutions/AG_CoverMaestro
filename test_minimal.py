"""Minimal test for order creation."""
import sys
sys.path.insert(0, '.')

from datetime import datetime
from app.database import SessionLocal
from app.models.core import MarketplaceOrder
from app.models.enums import Marketplace, OrderSource, NormalizedOrderStatus

db = SessionLocal()

try:
    print("Creating minimal order...")
    order = MarketplaceOrder(
        source=OrderSource.API_IMPORT,
        marketplace=Marketplace.REVERB,
        external_order_id="TEST123",
        order_date=datetime.utcnow(),
        imported_at=datetime.utcnow(),
        status_normalized=NormalizedOrderStatus.UNKNOWN,
        currency_code="USD",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(order)
    db.flush()
    print(f"SUCCESS: Order created id={order.id}")
    db.rollback()
except Exception as e:
    import traceback
    print(f"ERROR: {repr(e)}")
    traceback.print_exc()
    db.rollback()
finally:
    db.close()
