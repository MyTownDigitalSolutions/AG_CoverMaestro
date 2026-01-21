"""
Reverb Orders API - Import orders from Reverb marketplace.

Provides endpoints for:
- POST /api/reverb/orders/import - Import orders from Reverb into normalized tables
- GET /api/reverb/orders/sample - Fetch a sample order for debugging/validation
"""
import traceback
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import (
    MarketplaceImportRun, MarketplaceOrder, MarketplaceOrderAddress,
    MarketplaceOrderLine, MarketplaceOrderShipment
)
from app.models.enums import Marketplace, OrderSource, NormalizedOrderStatus
from app.services.reverb_service import (
    get_reverb_credentials, fetch_reverb_orders, fetch_single_reverb_order,
    map_reverb_order_to_schema, FetchResult,
    CredentialsNotConfiguredError, CredentialsDisabledError, ReverbAPIError
)


router = APIRouter(prefix="/reverb/orders", tags=["reverb-orders"])


# =============================================================================
# Request/Response Schemas
# =============================================================================

class ImportOrdersRequest(BaseModel):
    """Request body for order import."""
    days_back: int = 30
    since_iso: Optional[str] = None  # ISO datetime string, overrides days_back if provided
    date_to: Optional[datetime] = None
    limit: int = 50
    dry_run: bool = False  # If true, fetch and map but do not write to DB
    debug: bool = False  # If true, include debug diagnostics in response


class ImportOrdersResponse(BaseModel):
    """Response for order import operation."""
    import_run_id: Optional[int] = None  # None for dry_run
    dry_run: bool = False
    total_fetched: int
    total_created: int
    total_updated: int
    total_failed: int
    failed_order_ids: List[str]
    preview_orders: Optional[List[dict]] = None  # For dry_run mode
    # Debug fields (only populated when debug=true)
    filter_since_utc: Optional[str] = None
    filter_mode: Optional[str] = None  # "days_back" or "since_iso"
    timestamp_field_used: Optional[str] = None
    raw_fetched: Optional[int] = None
    filtered: Optional[int] = None
    pages_fetched: Optional[int] = None
    early_stop: Optional[bool] = None
    undated_count: Optional[int] = None


class SampleOrderResponse(BaseModel):
    """Response for sample order endpoint."""
    order: Optional[dict] = None
    mapped: Optional[dict] = None
    message: str


class NormalizeOrdersRequest(BaseModel):
    """Request body for normalize orders endpoint."""
    days_back: int = 30
    limit: int = 200
    dry_run: bool = True
    debug: bool = False
    force_rebuild_lines: bool = False  # If true, rebuild lines even if they exist


class NormalizeOrdersResponse(BaseModel):
    """Response for normalize orders endpoint."""
    dry_run: bool
    orders_scanned: int
    orders_updated: int
    addresses_upserted: int
    lines_upserted: int
    orders_skipped: int
    preview: Optional[List[dict]] = None
    debug: Optional[dict] = None


# =============================================================================
# Helper Functions
# =============================================================================

def _sanitize_order_for_preview(mapped_order: dict) -> dict:
    """
    Sanitize a mapped order for dry_run preview.
    Removes raw_marketplace_data to reduce size and removes any sensitive info.
    """
    preview = {
        "external_order_id": mapped_order.get("external_order_id"),
        "external_order_number": mapped_order.get("external_order_number"),
        "order_date": mapped_order.get("order_date"),
        "status_raw": mapped_order.get("status_raw"),
        "status_normalized": mapped_order.get("status_normalized"),
        "buyer_name": mapped_order.get("buyer_name"),
        "currency_code": mapped_order.get("currency_code"),
        "order_total_cents": mapped_order.get("order_total_cents"),
        "line_count": len(mapped_order.get("lines", [])),
        "address_count": len(mapped_order.get("addresses", [])),
    }
    return preview


def _parse_since_iso(since_iso: str) -> datetime:
    """
    Parse since_iso string to datetime.
    Raises ValueError if invalid.
    """
    # Try common ISO formats
    formats = [
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(since_iso, fmt)
        except ValueError:
            continue
    
    # Try fromisoformat as fallback
    try:
        return datetime.fromisoformat(since_iso.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        pass
    
    raise ValueError(f"Invalid ISO datetime format: {since_iso}")


def _upsert_order(db: Session, order_data: dict, import_run_id: int) -> tuple:
    """
    Upsert a single order into the database.
    
    Uses (marketplace, external_order_id) as unique identity.
    
    Returns:
        Tuple of (success: bool, is_new: bool, error_message: str or None)
    """
    try:
        external_order_id = order_data.get("external_order_id")
        if not external_order_id:
            return False, False, "Missing external_order_id"
        
        # Check for existing order using unique identity (marketplace, external_order_id)
        existing = db.query(MarketplaceOrder).filter(
            MarketplaceOrder.marketplace == Marketplace.REVERB,
            MarketplaceOrder.external_order_id == external_order_id
        ).first()
        
        is_new = existing is None
        
        if existing:
            order = existing
            # Update existing order fields
            order.import_run_id = import_run_id
            order.external_order_number = order_data.get("external_order_number")
            order.status_raw = order_data.get("status_raw")
            status_str = order_data.get("status_normalized", "unknown")
            order.status_normalized = NormalizedOrderStatus(status_str) if status_str in [e.value for e in NormalizedOrderStatus] else NormalizedOrderStatus.UNKNOWN
            order.buyer_name = order_data.get("buyer_name")
            order.buyer_email = order_data.get("buyer_email")
            order.currency_code = order_data.get("currency_code", "USD")
            order.items_subtotal_cents = order_data.get("items_subtotal_cents")
            order.shipping_cents = order_data.get("shipping_cents")
            order.tax_cents = order_data.get("tax_cents")
            order.order_total_cents = order_data.get("order_total_cents")
            order.raw_marketplace_data = order_data.get("raw_marketplace_data")
            order.last_synced_at = datetime.utcnow()
            order.updated_at = datetime.utcnow()
        else:
            status_str = order_data.get("status_normalized", "unknown")
            status_normalized = NormalizedOrderStatus(status_str) if status_str in [e.value for e in NormalizedOrderStatus] else NormalizedOrderStatus.UNKNOWN
            
            order = MarketplaceOrder(
                import_run_id=import_run_id,
                source=OrderSource.API_IMPORT,
                marketplace=Marketplace.REVERB,
                external_order_id=external_order_id,
                external_order_number=order_data.get("external_order_number"),
                order_date=datetime.fromisoformat(order_data["order_date"]) if order_data.get("order_date") else datetime.utcnow(),
                created_at_external=datetime.fromisoformat(order_data["created_at_external"].replace("Z", "+00:00")) if order_data.get("created_at_external") else None,
                imported_at=datetime.utcnow(),
                status_raw=order_data.get("status_raw"),
                status_normalized=status_normalized,
                buyer_name=order_data.get("buyer_name"),
                buyer_email=order_data.get("buyer_email"),
                currency_code=order_data.get("currency_code", "USD"),
                items_subtotal_cents=order_data.get("items_subtotal_cents"),
                shipping_cents=order_data.get("shipping_cents"),
                tax_cents=order_data.get("tax_cents"),
                order_total_cents=order_data.get("order_total_cents"),
                raw_marketplace_data=order_data.get("raw_marketplace_data"),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(order)
        
        db.flush()  # Get order ID
        
        # Handle addresses - delete existing and insert new
        addresses = order_data.get("addresses", [])
        if addresses:
            db.query(MarketplaceOrderAddress).filter(
                MarketplaceOrderAddress.order_id == order.id
            ).delete(synchronize_session=False)
            
            for addr_data in addresses:
                addr = MarketplaceOrderAddress(
                    order_id=order.id,
                    address_type=addr_data.get("address_type", "shipping"),
                    name=addr_data.get("name"),
                    phone=addr_data.get("phone"),
                    company=addr_data.get("company"),
                    line1=addr_data.get("line1"),
                    line2=addr_data.get("line2"),
                    city=addr_data.get("city"),
                    state_or_region=addr_data.get("state_or_region"),
                    postal_code=addr_data.get("postal_code"),
                    country_code=addr_data.get("country_code"),
                    raw_payload=addr_data.get("raw_payload")
                )
                db.add(addr)
        
        # Handle lines - delete existing and insert new
        lines = order_data.get("lines", [])
        if lines:
            db.query(MarketplaceOrderLine).filter(
                MarketplaceOrderLine.order_id == order.id
            ).delete(synchronize_session=False)
            
            for line_data in lines:
                line = MarketplaceOrderLine(
                    order_id=order.id,
                    external_line_item_id=line_data.get("external_line_item_id"),
                    sku=line_data.get("sku"),
                    title=line_data.get("title"),
                    quantity=line_data.get("quantity", 1),
                    unit_price_cents=line_data.get("unit_price_cents"),
                    line_total_cents=line_data.get("line_total_cents"),
                    customization_data=line_data.get("customization_data"),
                    raw_marketplace_data=line_data.get("raw_marketplace_data")
                )
                db.add(line)
        
        return True, is_new, None
        
    except Exception as e:
        return False, False, str(e)


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/import", response_model=ImportOrdersResponse)
def import_reverb_orders(
    request: ImportOrdersRequest,
    db: Session = Depends(get_db)
):
    """
    Import orders from Reverb into the normalized marketplace orders tables.
    
    - Creates a MarketplaceImportRun record (unless dry_run=true)
    - Fetches orders from Reverb API
    - Maps and upserts each order
    - Returns import summary
    
    Parameters:
    - days_back: Number of days back to fetch (default 30)
    - since_iso: ISO datetime string, overrides days_back if provided
    - limit: Maximum orders to fetch (default 50)
    - dry_run: If true, fetch and map but do not write to DB
    - debug: If true, include debug diagnostics in response
    """
    try:
        # Determine filter mode and parse since_iso if provided
        date_from = None
        filter_mode = "days_back"
        since_str = "N/A"
        
        if request.since_iso:
            try:
                date_from = _parse_since_iso(request.since_iso)
                filter_mode = "since_iso"
                since_str = request.since_iso
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        elif request.days_back:
            date_from = datetime.now(timezone.utc) - timedelta(days=request.days_back)
            filter_mode = "days_back"
            since_str = f"{request.days_back} days back"
        
        # Log start (no secrets)
        print(f"[REVERB_IMPORT] action=START days_back={request.days_back} since={since_str} limit={request.limit} dry_run={request.dry_run} debug={request.debug}")
        
        # Get credentials
        try:
            credentials = get_reverb_credentials(db)
        except CredentialsNotConfiguredError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except CredentialsDisabledError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Create import run record (only if not dry_run)
        import_run = None
        import_run_id = None
        if not request.dry_run:
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
            import_run_id = import_run.id
        
        # Fetch orders from Reverb (returns FetchResult with metadata)
        try:
            fetch_result: FetchResult = fetch_reverb_orders(
                credentials,
                date_from=date_from,
                date_to=request.date_to,
                days_back=None,  # Already handled via date_from
                limit=request.limit
            )
        except ReverbAPIError as e:
            if import_run:
                import_run.status = "failed"
                import_run.finished_at = datetime.utcnow()
                import_run.error_summary = {"error": str(e)}  # Safe, no tokens
                db.commit()
            # Return 502 for upstream API errors
            raise HTTPException(status_code=502, detail=f"Reverb API error: {str(e)}")
        
        raw_orders = fetch_result.orders
        
        # Handle no orders case
        if len(raw_orders) == 0:
            if import_run:
                import_run.orders_fetched = 0
                import_run.orders_upserted = 0
                import_run.errors_count = 0
                import_run.status = "success"
                import_run.finished_at = datetime.utcnow()
                db.commit()
            
            print(f"[REVERB_IMPORT] fetched=0 created=0 updated=0 failed=0 import_run_id={import_run_id}")
            
            response = ImportOrdersResponse(
                import_run_id=import_run_id,
                dry_run=request.dry_run,
                total_fetched=0,
                total_created=0,
                total_updated=0,
                total_failed=0,
                failed_order_ids=[],
                preview_orders=[] if request.dry_run else None
            )
            
            # Add debug fields if requested
            if request.debug:
                response.filter_since_utc = fetch_result.filter_since_utc
                response.filter_mode = filter_mode
                response.timestamp_field_used = fetch_result.timestamp_field_used
                response.raw_fetched = fetch_result.raw_fetched
                response.filtered = fetch_result.filtered
                response.pages_fetched = fetch_result.pages_fetched
                response.early_stop = fetch_result.early_stop
                response.undated_count = fetch_result.undated_count
            
            return response
        
        if import_run:
            import_run.orders_fetched = len(raw_orders)
        
        # Process each order
        created_count = 0
        updated_count = 0
        failed_count = 0
        failed_ids = []
        preview_orders = []
        
        for raw_order in raw_orders:
            order_id = str(raw_order.get("order_number") or raw_order.get("id", "unknown"))
            
            try:
                mapped_order = map_reverb_order_to_schema(raw_order)
                
                # Dry run: just collect preview, don't write
                if request.dry_run:
                    if len(preview_orders) < 3:  # Cap preview at 3 orders
                        preview_orders.append(_sanitize_order_for_preview(mapped_order))
                    
                    # Simulate what would happen
                    existing = db.query(MarketplaceOrder).filter(
                        MarketplaceOrder.marketplace == Marketplace.REVERB,
                        MarketplaceOrder.external_order_id == mapped_order.get("external_order_id")
                    ).first()
                    
                    if existing:
                        updated_count += 1
                    else:
                        created_count += 1
                    continue
                
                # Real run: upsert to DB
                success, is_new, error = _upsert_order(db, mapped_order, import_run_id)
                
                if success:
                    if is_new:
                        created_count += 1
                    else:
                        updated_count += 1
                else:
                    failed_count += 1
                    if len(failed_ids) < 20:  # Cap failed IDs list
                        failed_ids.append(order_id)
                    print(f"[REVERB_IMPORT] upsert_failed order_id={order_id} error={error}")
                    
            except Exception as e:
                failed_count += 1
                if len(failed_ids) < 20:
                    failed_ids.append(order_id)
                print(f"[REVERB_IMPORT] mapping_error order_id={order_id} error={repr(e)}")
        
        # Update import run (only if not dry_run)
        if import_run:
            import_run.orders_upserted = created_count + updated_count
            import_run.errors_count = failed_count
            import_run.status = "success" if failed_count == 0 else ("partial" if created_count + updated_count > 0 else "failed")
            import_run.finished_at = datetime.utcnow()
            
            if failed_ids:
                import_run.error_summary = {"failed_order_ids": failed_ids}
            
            db.commit()
        
        # Log completion (no secrets)
        print(f"[REVERB_IMPORT] fetched={len(raw_orders)} created={created_count} updated={updated_count} failed={failed_count} import_run_id={import_run_id} dry_run={request.dry_run}")
        
        response = ImportOrdersResponse(
            import_run_id=import_run_id,
            dry_run=request.dry_run,
            total_fetched=len(raw_orders),
            total_created=created_count,
            total_updated=updated_count,
            total_failed=failed_count,
            failed_order_ids=failed_ids,
            preview_orders=preview_orders if request.dry_run else None
        )
        
        # Add debug fields if requested
        if request.debug:
            response.filter_since_utc = fetch_result.filter_since_utc
            response.filter_mode = filter_mode
            response.timestamp_field_used = fetch_result.timestamp_field_used
            response.raw_fetched = fetch_result.raw_fetched
            response.filtered = fetch_result.filtered
            response.pages_fetched = fetch_result.pages_fetched
            response.early_stop = fetch_result.early_stop
            response.undated_count = fetch_result.undated_count
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[REVERB_IMPORT] unhandled_exception error={repr(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/sample", response_model=SampleOrderResponse)
def get_sample_reverb_order(
    db: Session = Depends(get_db)
):
    """
    Fetch a single sample order from Reverb for mapping validation.
    
    Returns raw order JSON and mapped version for admin debugging.
    """
    try:
        # Get credentials
        try:
            credentials = get_reverb_credentials(db)
        except CredentialsNotConfiguredError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except CredentialsDisabledError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Fetch single order
        try:
            raw_order = fetch_single_reverb_order(credentials)
        except ReverbAPIError as e:
            raise HTTPException(status_code=502, detail=f"Reverb API error: {str(e)}")
        
        if not raw_order:
            return SampleOrderResponse(
                order=None,
                mapped=None,
                message="No orders found in Reverb account"
            )
        
        # Map the order
        mapped = map_reverb_order_to_schema(raw_order)
        
        return SampleOrderResponse(
            order=raw_order,
            mapped=mapped,
            message="Sample order retrieved successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[REVERB_IMPORT] sample_error error={repr(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")


# =============================================================================
# Normalization Helpers
# =============================================================================

def _extract_reverb_buyer_info(raw: dict) -> dict:
    """Extract buyer info from Reverb raw_marketplace_data."""
    return {
        "buyer_email": raw.get("buyer_email"),
        "buyer_name": raw.get("buyer", {}).get("first_name") if raw.get("buyer") else None,
    }


def _extract_reverb_totals(raw: dict) -> dict:
    """Extract monetary totals from Reverb raw_marketplace_data."""
    totals = {}
    
    # amount_product → items_subtotal_cents
    amount_product = raw.get("amount_product", {})
    if amount_product and amount_product.get("amount_cents") is not None:
        totals["items_subtotal_cents"] = amount_product.get("amount_cents")
    
    # shipping → shipping_cents
    shipping = raw.get("shipping", {})
    if shipping and shipping.get("amount_cents") is not None:
        totals["shipping_cents"] = shipping.get("amount_cents")
    
    # amount_tax → tax_cents
    amount_tax = raw.get("amount_tax", {})
    if amount_tax and amount_tax.get("amount_cents") is not None:
        totals["tax_cents"] = amount_tax.get("amount_cents")
    
    # total → order_total_cents
    total = raw.get("total", {})
    if total and total.get("amount_cents") is not None:
        totals["order_total_cents"] = total.get("amount_cents")
    
    # Currency code (prefer from total, fallback to amount_product)
    currency = None
    if total and total.get("currency"):
        currency = total.get("currency")
    elif amount_product and amount_product.get("currency"):
        currency = amount_product.get("currency")
    
    if currency:
        totals["currency_code"] = currency
    
    return totals


def _extract_reverb_shipping_address(raw: dict, external_order_id: str) -> Optional[dict]:
    """Extract shipping address from Reverb raw_marketplace_data."""
    shipping_addr = raw.get("shipping_address")
    if not shipping_addr:
        return None
    
    return {
        "address_type": "shipping",
        "name": shipping_addr.get("name"),
        "line1": shipping_addr.get("street_address"),
        "line2": shipping_addr.get("extended_address"),
        "city": shipping_addr.get("locality"),
        "state_or_region": shipping_addr.get("region"),
        "postal_code": shipping_addr.get("postal_code"),
        "country_code": shipping_addr.get("country_code"),
        "phone": shipping_addr.get("phone"),
        "raw_payload": shipping_addr,  # Store original for debugging
    }


def _extract_reverb_line_item(raw: dict, external_order_id: str) -> dict:
    """Create a minimal line item from Reverb raw_marketplace_data."""
    product_id = raw.get("product_id") or raw.get("product", {}).get("id")
    quantity = raw.get("quantity", 1)
    
    # Get price from amount_product
    amount_product = raw.get("amount_product", {})
    line_total_cents = amount_product.get("amount_cents") if amount_product else None
    unit_price_cents = line_total_cents // quantity if line_total_cents and quantity else None
    
    # Generate deterministic external_line_item_id
    external_line_item_id = f"{external_order_id}-1"
    
    # Try to get title from product
    title = None
    product = raw.get("product")
    if product:
        title = product.get("title") or product.get("name")
    if not title and product_id:
        title = f"(Reverb product {product_id})"
    
    return {
        "external_line_item_id": external_line_item_id,
        "product_id": str(product_id) if product_id else None,
        "quantity": quantity,
        "unit_price_cents": unit_price_cents,
        "line_total_cents": line_total_cents,
        "title": title,
        "sku": raw.get("sku"),
    }


@router.post("/normalize", response_model=NormalizeOrdersResponse)
def normalize_reverb_orders(
    request: NormalizeOrdersRequest,
    db: Session = Depends(get_db)
):
    """
    Normalize existing Reverb orders by populating buyer, totals, addresses, and lines
    from raw_marketplace_data.
    
    Parameters:
    - days_back: Number of days back to filter orders (default 30)
    - limit: Maximum orders to process (default 200)
    - dry_run: If true, compute but don't write changes (default true)
    - debug: If true, include debug info in response
    - force_rebuild_lines: If true, rebuild lines even if they exist (default false)
    """
    try:
        # Calculate date cutoff
        cutoff = datetime.utcnow() - timedelta(days=request.days_back)
        
        print(f"[REVERB_NORMALIZE] action=START days_back={request.days_back} limit={request.limit} dry_run={request.dry_run} force_rebuild_lines={request.force_rebuild_lines}")
        
        # Query Reverb orders with raw_marketplace_data
        orders = db.query(MarketplaceOrder).filter(
            MarketplaceOrder.marketplace == Marketplace.REVERB,
            MarketplaceOrder.order_date >= cutoff,
            MarketplaceOrder.raw_marketplace_data.isnot(None)
        ).order_by(MarketplaceOrder.order_date.desc()).limit(request.limit).all()
        
        orders_scanned = len(orders)
        orders_updated = 0
        orders_skipped = 0
        addresses_upserted = 0
        lines_upserted = 0
        preview = []
        debug_info = {} if request.debug else None
        
        for order in orders:
            raw = order.raw_marketplace_data
            if not isinstance(raw, dict):
                orders_skipped += 1
                continue
            
            external_order_id = order.external_order_id or str(order.id)
            order_updated = False
            preview_item = {"order_id": order.id, "external_order_id": external_order_id}
            
            # 1. Extract and apply buyer info
            buyer_info = _extract_reverb_buyer_info(raw)
            if buyer_info.get("buyer_email") and not order.buyer_email:
                if not request.dry_run:
                    order.buyer_email = buyer_info["buyer_email"]
                preview_item["buyer_email"] = buyer_info["buyer_email"]
                order_updated = True
            if buyer_info.get("buyer_name") and not order.buyer_name:
                if not request.dry_run:
                    order.buyer_name = buyer_info["buyer_name"]
                preview_item["buyer_name"] = buyer_info["buyer_name"]
                order_updated = True
            
            # 2. Extract and apply totals
            totals = _extract_reverb_totals(raw)
            for field, value in totals.items():
                current_value = getattr(order, field, None)
                if value is not None and current_value is None:
                    if not request.dry_run:
                        setattr(order, field, value)
                    preview_item[field] = value
                    order_updated = True
            
            # 3. Extract and upsert shipping address
            addr_data = _extract_reverb_shipping_address(raw, external_order_id)
            if addr_data:
                preview_item["address"] = {
                    "city": addr_data.get("city"),
                    "state_or_region": addr_data.get("state_or_region"),
                    "country_code": addr_data.get("country_code"),
                }
                
                if not request.dry_run:
                    # Check if shipping address already exists
                    existing_addr = db.query(MarketplaceOrderAddress).filter(
                        MarketplaceOrderAddress.order_id == order.id,
                        MarketplaceOrderAddress.address_type == "shipping"
                    ).first()
                    
                    if existing_addr:
                        # Update existing
                        for key, val in addr_data.items():
                            if key != "address_type" and val is not None:
                                setattr(existing_addr, key, val)
                    else:
                        # Create new
                        new_addr = MarketplaceOrderAddress(
                            order_id=order.id,
                            address_type=addr_data.get("address_type", "shipping"),
                            name=addr_data.get("name"),
                            line1=addr_data.get("line1"),
                            line2=addr_data.get("line2"),
                            city=addr_data.get("city"),
                            state_or_region=addr_data.get("state_or_region"),
                            postal_code=addr_data.get("postal_code"),
                            country_code=addr_data.get("country_code"),
                            phone=addr_data.get("phone"),
                            raw_payload=addr_data.get("raw_payload")
                        )
                        db.add(new_addr)
                    
                    addresses_upserted += 1
                else:
                    addresses_upserted += 1  # Count for preview
                
                order_updated = True
            
            # 4. Extract and upsert line item (only if no lines exist or force_rebuild)
            existing_lines_count = db.query(MarketplaceOrderLine).filter(
                MarketplaceOrderLine.order_id == order.id
            ).count()
            
            should_create_line = (existing_lines_count == 0) or request.force_rebuild_lines
            
            if should_create_line:
                line_data = _extract_reverb_line_item(raw, external_order_id)
                preview_item["line"] = {
                    "title": line_data.get("title"),
                    "quantity": line_data.get("quantity"),
                    "line_total_cents": line_data.get("line_total_cents"),
                }
                
                if not request.dry_run:
                    if request.force_rebuild_lines and existing_lines_count > 0:
                        # Delete existing lines first
                        db.query(MarketplaceOrderLine).filter(
                            MarketplaceOrderLine.order_id == order.id
                        ).delete(synchronize_session=False)
                    
                    new_line = MarketplaceOrderLine(
                        order_id=order.id,
                        external_line_item_id=line_data.get("external_line_item_id"),
                        product_id=line_data.get("product_id"),
                        sku=line_data.get("sku"),
                        title=line_data.get("title"),
                        quantity=line_data.get("quantity", 1),
                        unit_price_cents=line_data.get("unit_price_cents"),
                        line_total_cents=line_data.get("line_total_cents"),
                    )
                    db.add(new_line)
                    lines_upserted += 1
                else:
                    lines_upserted += 1  # Count for preview
                
                order_updated = True
            else:
                preview_item["line_skipped"] = f"existing_lines={existing_lines_count}"
            
            if order_updated:
                orders_updated += 1
                if len(preview) < 3:
                    preview.append(preview_item)
            else:
                orders_skipped += 1
        
        if not request.dry_run:
            db.commit()
        
        print(f"[REVERB_NORMALIZE] scanned={orders_scanned} updated={orders_updated} skipped={orders_skipped} addresses={addresses_upserted} lines={lines_upserted} dry_run={request.dry_run}")
        
        if request.debug:
            debug_info = {
                "cutoff_utc": cutoff.isoformat(),
                "days_back": request.days_back,
                "limit": request.limit,
                "force_rebuild_lines": request.force_rebuild_lines,
            }
        
        return NormalizeOrdersResponse(
            dry_run=request.dry_run,
            orders_scanned=orders_scanned,
            orders_updated=orders_updated,
            addresses_upserted=addresses_upserted,
            lines_upserted=lines_upserted,
            orders_skipped=orders_skipped,
            preview=preview if preview else None,
            debug=debug_info
        )
        
    except Exception as e:
        print(f"[REVERB_NORMALIZE] unhandled_exception error={repr(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Internal server error")
