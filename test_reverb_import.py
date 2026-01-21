"""Test script for Reverb order import."""
import sys
sys.path.insert(0, '.')

from datetime import datetime
from app.database import SessionLocal
from app.models.core import MarketplaceImportRun, MarketplaceOrder
from app.models.enums import Marketplace, OrderSource, NormalizedOrderStatus
from app.services.reverb_service import (
    get_reverb_credentials, fetch_reverb_orders, map_reverb_order_to_schema
)

db = SessionLocal()

try:
    # Get credentials
    print("Getting credentials...")
    creds = get_reverb_credentials(db)
    print(f"Credentials: base_url={creds.base_url}, enabled={creds.is_enabled}")
    
    # Fetch orders
    print("\nFetching orders...")
    orders, total = fetch_reverb_orders(creds, limit=1)
    print(f"Fetched {len(orders)} orders (total available: {total})")
    
    if orders:
        raw = orders[0]
        print(f"\nRaw order keys: {list(raw.keys())}")
        
        # Map order
        print("\nMapping order...")
        mapped = map_reverb_order_to_schema(raw)
        print(f"Mapped keys: {list(mapped.keys())}")
        print(f"external_order_id: {mapped.get('external_order_id')}")
        print(f"status_normalized: {mapped.get('status_normalized')}")
        
        # Try to create import run
        print("\nCreating import run...")
        import_run = MarketplaceImportRun(
            marketplace=Marketplace.REVERB,
            started_at=datetime.utcnow(),
            status="running",
            orders_fetched=0,
            orders_upserted=0,
            errors_count=0
        )
        db.add(import_run)
        db.flush()
        print(f"Import run created: id={import_run.id}")
        
        # Try to create order
        print("\nCreating order...")
        status_str = mapped.get("status_normalized", "unknown")
        status_normalized = NormalizedOrderStatus(status_str) if status_str in [e.value for e in NormalizedOrderStatus] else NormalizedOrderStatus.UNKNOWN
        
        order = MarketplaceOrder(
            import_run_id=import_run.id,
            source=OrderSource.API_IMPORT,
            marketplace=Marketplace.REVERB,
            external_order_id=mapped.get("external_order_id"),
            external_order_number=mapped.get("external_order_number"),
            order_date=datetime.fromisoformat(mapped["order_date"]) if mapped.get("order_date") else datetime.utcnow(),
            imported_at=datetime.utcnow(),
            status_raw=mapped.get("status_raw"),
            status_normalized=status_normalized,
            buyer_name=mapped.get("buyer_name"),
            buyer_email=mapped.get("buyer_email"),
            currency_code=mapped.get("currency_code", "USD"),
            items_subtotal_cents=mapped.get("items_subtotal_cents"),
            shipping_cents=mapped.get("shipping_cents"),
            tax_cents=mapped.get("tax_cents"),
            order_total_cents=mapped.get("order_total_cents"),
            raw_marketplace_data=mapped.get("raw_marketplace_data"),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(order)
        db.flush()
        print(f"Order created: id={order.id}")
        
        # Rollback to not actually commit test data
        db.rollback()
        print("\nRolled back test data.")
        
except Exception as e:
    import traceback
    print(f"\nERROR: {repr(e)}")
    print(traceback.format_exc())
    db.rollback()
finally:
    db.close()
