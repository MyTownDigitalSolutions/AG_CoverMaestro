"""
Marketplace Orders API - Canonical Order Import Tables

Provides endpoints for:
- Upserting orders from marketplace API imports
- Creating manual orders
- Querying orders with filters
"""
import traceback
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import templates  # Ensure AmazonCustomizationTemplate is registered for SQLAlchemy relationships
from app.models.core import (
    MarketplaceOrder, MarketplaceOrderAddress, MarketplaceOrderLine, 
    MarketplaceOrderShipment, MarketplaceImportRun
)
from app.models.enums import OrderSource, NormalizedOrderStatus, Marketplace
from app.schemas.core import (
    MarketplaceOrderCreate, MarketplaceOrderUpdate, MarketplaceOrderResponse,
    MarketplaceOrderDetailResponse, MarketplaceOrderAddressCreate,
    MarketplaceOrderLineCreate, MarketplaceOrderShipmentCreate
)

router = APIRouter(prefix="/marketplace-orders", tags=["marketplace-orders"])


def _replace_children_if_provided(
    db: Session, 
    order: MarketplaceOrder, 
    data: MarketplaceOrderCreate,
    raw_data: dict
):
    """
    Replace child records only when the field is explicitly provided in the request.
    
    Rules:
    - If field is missing/not in payload → leave existing children unchanged
    - If field is present as [] → delete all children of that type
    - If field is present with N items → delete all then insert N
    """
    
    # Handle addresses - only if 'addresses' key exists in raw payload
    if 'addresses' in raw_data:
        deleted_count = db.query(MarketplaceOrderAddress).filter(
            MarketplaceOrderAddress.order_id == order.id
        ).delete(synchronize_session=False)
        
        inserted_count = 0
        for addr_data in data.addresses:
            addr = MarketplaceOrderAddress(
                order_id=order.id,
                address_type=addr_data.address_type,
                name=addr_data.name,
                phone=addr_data.phone,
                company=addr_data.company,
                line1=addr_data.line1,
                line2=addr_data.line2,
                city=addr_data.city,
                state_or_region=addr_data.state_or_region,
                postal_code=addr_data.postal_code,
                country_code=addr_data.country_code,
                raw_payload=addr_data.raw_payload
            )
            db.add(addr)
            inserted_count += 1
        
        print(f"[MARKETPLACE_ORDERS]   addresses: deleted={deleted_count}, inserted={inserted_count}")
    
    # Handle lines - only if 'lines' key exists in raw payload
    if 'lines' in raw_data:
        deleted_count = db.query(MarketplaceOrderLine).filter(
            MarketplaceOrderLine.order_id == order.id
        ).delete(synchronize_session=False)
        
        inserted_count = 0
        for line_data in data.lines:
            line = MarketplaceOrderLine(
                order_id=order.id,
                external_line_item_id=line_data.external_line_item_id,
                marketplace_item_id=line_data.marketplace_item_id,
                sku=line_data.sku,
                asin=line_data.asin,
                listing_id=line_data.listing_id,
                product_id=line_data.product_id,
                title=line_data.title,
                variant=line_data.variant,
                quantity=line_data.quantity,
                currency_code=line_data.currency_code,
                unit_price_cents=line_data.unit_price_cents,
                line_subtotal_cents=line_data.line_subtotal_cents,
                tax_cents=line_data.tax_cents,
                discount_cents=line_data.discount_cents,
                line_total_cents=line_data.line_total_cents,
                fulfillment_status_raw=line_data.fulfillment_status_raw,
                fulfillment_status_normalized=line_data.fulfillment_status_normalized,
                model_id=line_data.model_id,
                customization_data=line_data.customization_data,
                raw_marketplace_data=line_data.raw_marketplace_data
            )
            db.add(line)
            inserted_count += 1
        
        print(f"[MARKETPLACE_ORDERS]   lines: deleted={deleted_count}, inserted={inserted_count}")
    
    # Handle shipments - only if 'shipments' key exists in raw payload
    if 'shipments' in raw_data:
        deleted_count = db.query(MarketplaceOrderShipment).filter(
            MarketplaceOrderShipment.order_id == order.id
        ).delete(synchronize_session=False)
        
        inserted_count = 0
        for ship_data in data.shipments:
            shipment = MarketplaceOrderShipment(
                order_id=order.id,
                external_shipment_id=ship_data.external_shipment_id,
                carrier=ship_data.carrier,
                service=ship_data.service,
                tracking_number=ship_data.tracking_number,
                shipped_at=ship_data.shipped_at,
                delivered_at=ship_data.delivered_at,
                raw_marketplace_data=ship_data.raw_marketplace_data
            )
            db.add(shipment)
            inserted_count += 1
        
        print(f"[MARKETPLACE_ORDERS]   shipments: deleted={deleted_count}, inserted={inserted_count}")


def _insert_children(db: Session, order: MarketplaceOrder, data: MarketplaceOrderCreate):
    """
    Insert child records for a new order (no replacement logic needed).
    Used for manual orders and initial create.
    """
    # Insert addresses
    for addr_data in data.addresses:
        addr = MarketplaceOrderAddress(
            order_id=order.id,
            address_type=addr_data.address_type,
            name=addr_data.name,
            phone=addr_data.phone,
            company=addr_data.company,
            line1=addr_data.line1,
            line2=addr_data.line2,
            city=addr_data.city,
            state_or_region=addr_data.state_or_region,
            postal_code=addr_data.postal_code,
            country_code=addr_data.country_code,
            raw_payload=addr_data.raw_payload
        )
        db.add(addr)
    
    # Insert lines
    for line_data in data.lines:
        line = MarketplaceOrderLine(
            order_id=order.id,
            external_line_item_id=line_data.external_line_item_id,
            marketplace_item_id=line_data.marketplace_item_id,
            sku=line_data.sku,
            asin=line_data.asin,
            listing_id=line_data.listing_id,
            product_id=line_data.product_id,
            title=line_data.title,
            variant=line_data.variant,
            quantity=line_data.quantity,
            currency_code=line_data.currency_code,
            unit_price_cents=line_data.unit_price_cents,
            line_subtotal_cents=line_data.line_subtotal_cents,
            tax_cents=line_data.tax_cents,
            discount_cents=line_data.discount_cents,
            line_total_cents=line_data.line_total_cents,
            fulfillment_status_raw=line_data.fulfillment_status_raw,
            fulfillment_status_normalized=line_data.fulfillment_status_normalized,
            model_id=line_data.model_id,
            customization_data=line_data.customization_data,
            raw_marketplace_data=line_data.raw_marketplace_data
        )
        db.add(line)
    
    # Insert shipments
    for ship_data in data.shipments:
        shipment = MarketplaceOrderShipment(
            order_id=order.id,
            external_shipment_id=ship_data.external_shipment_id,
            carrier=ship_data.carrier,
            service=ship_data.service,
            tracking_number=ship_data.tracking_number,
            shipped_at=ship_data.shipped_at,
            delivered_at=ship_data.delivered_at,
            raw_marketplace_data=ship_data.raw_marketplace_data
        )
        db.add(shipment)
    
    child_summary = f"addresses={len(data.addresses)}, lines={len(data.lines)}, shipments={len(data.shipments)}"
    print(f"[MARKETPLACE_ORDERS]   children inserted: {child_summary}")


def _update_order_fields_selective(order: MarketplaceOrder, data: MarketplaceOrderCreate, raw_data: dict):
    """
    Update order fields selectively - only update fields that are explicitly provided.
    Preserves existing values when incoming is None/missing.
    """
    # Always update these core identification fields
    if 'source' in raw_data:
        order.source = data.source
    if 'marketplace' in raw_data:
        order.marketplace = data.marketplace
    if 'external_order_id' in raw_data:
        order.external_order_id = data.external_order_id
    if 'external_order_number' in raw_data:
        order.external_order_number = data.external_order_number
    if 'external_store_id' in raw_data:
        order.external_store_id = data.external_store_id
    
    # Date fields
    if 'order_date' in raw_data:
        order.order_date = data.order_date
    if 'created_at_external' in raw_data:
        order.created_at_external = data.created_at_external
    if 'updated_at_external' in raw_data:
        order.updated_at_external = data.updated_at_external
    
    # Status fields
    if 'status_raw' in raw_data:
        order.status_raw = data.status_raw
    if 'status_normalized' in raw_data:
        order.status_normalized = data.status_normalized
    
    # Buyer fields
    if 'buyer_name' in raw_data:
        order.buyer_name = data.buyer_name
    if 'buyer_email' in raw_data:
        order.buyer_email = data.buyer_email
    if 'buyer_phone' in raw_data:
        order.buyer_phone = data.buyer_phone
    
    # Money fields
    if 'currency_code' in raw_data:
        order.currency_code = data.currency_code
    if 'items_subtotal_cents' in raw_data:
        order.items_subtotal_cents = data.items_subtotal_cents
    if 'shipping_cents' in raw_data:
        order.shipping_cents = data.shipping_cents
    if 'tax_cents' in raw_data:
        order.tax_cents = data.tax_cents
    if 'discount_cents' in raw_data:
        order.discount_cents = data.discount_cents
    if 'fees_cents' in raw_data:
        order.fees_cents = data.fees_cents
    if 'refunded_cents' in raw_data:
        order.refunded_cents = data.refunded_cents
    if 'order_total_cents' in raw_data:
        order.order_total_cents = data.order_total_cents
    
    # Fulfillment fields
    if 'fulfillment_channel' in raw_data:
        order.fulfillment_channel = data.fulfillment_channel
    if 'shipping_service_level' in raw_data:
        order.shipping_service_level = data.shipping_service_level
    if 'ship_by_date' in raw_data:
        order.ship_by_date = data.ship_by_date
    if 'deliver_by_date' in raw_data:
        order.deliver_by_date = data.deliver_by_date
    
    # Ops fields
    if 'notes' in raw_data:
        order.notes = data.notes
    if 'import_error' in raw_data:
        order.import_error = data.import_error
    if 'raw_marketplace_data' in raw_data:
        order.raw_marketplace_data = data.raw_marketplace_data
    if 'import_run_id' in raw_data:
        order.import_run_id = data.import_run_id


@router.post("/upsert", response_model=MarketplaceOrderDetailResponse)
def upsert_marketplace_order(data: MarketplaceOrderCreate, db: Session = Depends(get_db)):
    """
    Upsert a marketplace order.
    
    - If marketplace + external_order_id exists: update existing order
    - Otherwise: create new order
    - Only replaces children (addresses, lines, shipments) if those fields are present in request
    - Only updates scalar fields that are explicitly provided
    """
    try:
        now = datetime.utcnow()
        
        # Get the raw dict to check which fields were actually provided
        raw_data = data.model_dump(exclude_unset=True)
        
        # Validation: if marketplace is set, external_order_id is required
        if data.marketplace is not None and not data.external_order_id:
            raise HTTPException(
                status_code=400,
                detail="external_order_id is required when marketplace is set"
            )
        
        existing_order = None
        if data.marketplace is not None and data.external_order_id:
            existing_order = db.query(MarketplaceOrder).filter(
                MarketplaceOrder.marketplace == data.marketplace,
                MarketplaceOrder.external_order_id == data.external_order_id
            ).first()
        
        if existing_order:
            # UPDATE path
            print(f"[MARKETPLACE_ORDERS] action=UPDATE marketplace={data.marketplace} external_order_id={data.external_order_id} order_id={existing_order.id}")
            
            _update_order_fields_selective(existing_order, data, raw_data)
            existing_order.last_synced_at = now
            
            # Replace children only if provided in payload
            _replace_children_if_provided(db, existing_order, data, raw_data)
            
            db.commit()
            db.refresh(existing_order)
            return existing_order
        else:
            # CREATE path
            order = MarketplaceOrder(
                import_run_id=data.import_run_id,
                source=data.source,
                marketplace=data.marketplace,
                external_order_id=data.external_order_id,
                external_order_number=data.external_order_number,
                external_store_id=data.external_store_id,
                order_date=data.order_date,
                created_at_external=data.created_at_external,
                updated_at_external=data.updated_at_external,
                imported_at=now,
                last_synced_at=now,
                status_raw=data.status_raw,
                status_normalized=data.status_normalized,
                buyer_name=data.buyer_name,
                buyer_email=data.buyer_email,
                buyer_phone=data.buyer_phone,
                currency_code=data.currency_code,
                items_subtotal_cents=data.items_subtotal_cents,
                shipping_cents=data.shipping_cents,
                tax_cents=data.tax_cents,
                discount_cents=data.discount_cents,
                fees_cents=data.fees_cents,
                refunded_cents=data.refunded_cents,
                order_total_cents=data.order_total_cents,
                fulfillment_channel=data.fulfillment_channel,
                shipping_service_level=data.shipping_service_level,
                ship_by_date=data.ship_by_date,
                deliver_by_date=data.deliver_by_date,
                notes=data.notes,
                import_error=data.import_error,
                raw_marketplace_data=data.raw_marketplace_data
            )
            db.add(order)
            db.commit()
            db.refresh(order)
            
            print(f"[MARKETPLACE_ORDERS] action=CREATE marketplace={data.marketplace} external_order_id={data.external_order_id} order_id={order.id}")
            
            # Insert children for new order
            _insert_children(db, order, data)
            db.commit()
            db.refresh(order)
            
            return order
    except Exception as e:
        print("[MARKETPLACE_ORDERS] Unhandled exception in upsert_marketplace_order:", repr(e))
        print(traceback.format_exc())
        raise


@router.post("/manual", response_model=MarketplaceOrderDetailResponse)
def create_manual_order(data: MarketplaceOrderCreate, db: Session = Depends(get_db)):
    """
    Create a manual order (not from marketplace import).
    
    - Forces source = MANUAL
    - Forces marketplace = None
    - Ignores any provided marketplace/external_order_id
    """
    try:
        now = datetime.utcnow()
        
        order = MarketplaceOrder(
            import_run_id=None,
            source=OrderSource.MANUAL,
            marketplace=None,
            external_order_id=None,
            external_order_number=None,
            external_store_id=None,
            order_date=data.order_date,
            created_at_external=None,
            updated_at_external=None,
            imported_at=now,
            last_synced_at=None,
            status_raw=None,
            status_normalized=data.status_normalized or NormalizedOrderStatus.PENDING,
            buyer_name=data.buyer_name,
            buyer_email=data.buyer_email,
            buyer_phone=data.buyer_phone,
            currency_code=data.currency_code,
            items_subtotal_cents=data.items_subtotal_cents,
            shipping_cents=data.shipping_cents,
            tax_cents=data.tax_cents,
            discount_cents=data.discount_cents,
            fees_cents=data.fees_cents,
            refunded_cents=data.refunded_cents,
            order_total_cents=data.order_total_cents,
            fulfillment_channel=data.fulfillment_channel,
            shipping_service_level=data.shipping_service_level,
            ship_by_date=data.ship_by_date,
            deliver_by_date=data.deliver_by_date,
            notes=data.notes,
            import_error=None,
            raw_marketplace_data=None
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        
        print(f"[MARKETPLACE_ORDERS] action=CREATE_MANUAL order_id={order.id}")
        
        # Insert children for new order
        _insert_children(db, order, data)
        db.commit()
        db.refresh(order)
        
        return order
    except Exception as e:
        print("[MARKETPLACE_ORDERS] Unhandled exception in create_manual_order:", repr(e))
        print(traceback.format_exc())
        raise


@router.get("", response_model=List[MarketplaceOrderResponse])
def list_marketplace_orders(
    marketplace: Optional[Marketplace] = None,
    status_normalized: Optional[NormalizedOrderStatus] = None,
    buyer_email: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db)
):
    """
    List marketplace orders with optional filters.
    
    Returns flat order list (no nested children).
    """
    try:
        query = db.query(MarketplaceOrder)
        
        if marketplace is not None:
            query = query.filter(MarketplaceOrder.marketplace == marketplace)
        
        if status_normalized is not None:
            query = query.filter(MarketplaceOrder.status_normalized == status_normalized)
        
        if buyer_email:
            query = query.filter(MarketplaceOrder.buyer_email.ilike(f"%{buyer_email}%"))
        
        if date_from:
            query = query.filter(MarketplaceOrder.order_date >= date_from)
        
        if date_to:
            query = query.filter(MarketplaceOrder.order_date <= date_to)
        
        query = query.order_by(MarketplaceOrder.order_date.desc())
        query = query.limit(limit)
        
        return query.all()
    except Exception as e:
        print("[MARKETPLACE_ORDERS] Unhandled exception in list_marketplace_orders:", repr(e))
        print(traceback.format_exc())
        raise


@router.get("/{id}", response_model=MarketplaceOrderDetailResponse)
def get_marketplace_order(id: int, db: Session = Depends(get_db)):
    """
    Get a single marketplace order by ID with nested children.
    """
    try:
        order = db.query(MarketplaceOrder).filter(MarketplaceOrder.id == id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Marketplace order not found")
        return order
    except Exception as e:
        print("[MARKETPLACE_ORDERS] Unhandled exception in get_marketplace_order:", repr(e))
        print(traceback.format_exc())
        raise


@router.delete("/{id}")
def delete_marketplace_order(id: int, db: Session = Depends(get_db)):
    """
    Delete a marketplace order and all its children.
    """
    try:
        order = db.query(MarketplaceOrder).filter(MarketplaceOrder.id == id).first()
        if not order:
            raise HTTPException(status_code=404, detail="Marketplace order not found")
        
        db.delete(order)
        db.commit()
        return {"message": "Marketplace order deleted"}
    except Exception as e:
        print("[MARKETPLACE_ORDERS] Unhandled exception in delete_marketplace_order:", repr(e))
        print(traceback.format_exc())
        raise
