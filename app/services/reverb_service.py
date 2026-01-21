"""
Reverb Service - Client for Reverb API integration.

Provides functions to:
- Get stored Reverb credentials from database
- Fetch orders from Reverb API with proper date filtering
- Map Reverb order data to normalized format
"""
import os
import json
import traceback
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, field

import requests
from sqlalchemy.orm import Session

from app.models.core import MarketplaceCredential


# Environment variables
CREDENTIALS_MASTER_KEY = os.getenv("CREDENTIALS_MASTER_KEY", "")
ALLOW_PLAINTEXT_CREDENTIALS = os.getenv("ALLOW_PLAINTEXT_CREDENTIALS", "false").lower() == "true"


@dataclass
class ReverbCredentials:
    """Credentials for Reverb API access."""
    api_token: str
    base_url: str
    is_enabled: bool


@dataclass
class FetchResult:
    """Result from fetch_reverb_orders with metadata for diagnostics."""
    orders: List[Dict[str, Any]]
    raw_fetched: int
    filtered: int
    pages_fetched: int
    early_stop: bool
    undated_count: int
    filter_since_utc: Optional[str] = None  # ISO string of cutoff used
    timestamp_field_used: str = "created_at > ordered_at > updated_at"  # Priority rule


class ReverbServiceError(Exception):
    """Base exception for Reverb service errors."""
    pass


class CredentialsNotConfiguredError(ReverbServiceError):
    """Raised when credentials are not configured."""
    pass


class CredentialsDisabledError(ReverbServiceError):
    """Raised when credentials are disabled."""
    pass


class ReverbAPIError(ReverbServiceError):
    """Raised when Reverb API returns an error."""
    def __init__(self, message: str, status_code: int = 0):
        super().__init__(message)
        self.status_code = status_code


def _decrypt_secrets(blob: str) -> dict:
    """Decrypt secrets blob from database."""
    if blob.startswith("encrypted:"):
        if not CREDENTIALS_MASTER_KEY:
            raise ReverbServiceError("Cannot decrypt: CREDENTIALS_MASTER_KEY not configured")
        try:
            from cryptography.fernet import Fernet
            import base64
            import hashlib
            
            key_bytes = hashlib.sha256(CREDENTIALS_MASTER_KEY.encode()).digest()
            fernet_key = base64.urlsafe_b64encode(key_bytes)
            
            f = Fernet(fernet_key)
            encrypted_data = blob[len("encrypted:"):]
            decrypted = f.decrypt(encrypted_data.encode())
            return json.loads(decrypted.decode())
        except ImportError:
            raise ReverbServiceError("Cannot decrypt: cryptography library not installed")
        except Exception as e:
            raise ReverbServiceError(f"Decryption failed: {str(e)}")
    
    # Plaintext JSON
    try:
        return json.loads(blob)
    except json.JSONDecodeError as e:
        raise ReverbServiceError(f"Invalid credentials format: {str(e)}")


def get_reverb_credentials(db: Session) -> ReverbCredentials:
    """
    Get Reverb credentials from database.
    
    Args:
        db: Database session
        
    Returns:
        ReverbCredentials with api_token, base_url, and is_enabled
        
    Raises:
        CredentialsNotConfiguredError: If credentials not set up
        CredentialsDisabledError: If credentials are disabled
        ReverbServiceError: For other credential issues
    """
    cred = db.query(MarketplaceCredential).filter(
        MarketplaceCredential.marketplace == "reverb"
    ).first()
    
    if not cred:
        raise CredentialsNotConfiguredError("Reverb credentials not configured")
    
    if not cred.is_enabled:
        raise CredentialsDisabledError("Reverb credentials disabled")
    
    secrets = _decrypt_secrets(cred.secrets_blob)
    
    api_token = secrets.get("api_token", "")
    if not api_token:
        raise CredentialsNotConfiguredError("Reverb API token is empty")
    
    return ReverbCredentials(
        api_token=api_token,
        base_url=secrets.get("base_url", "https://api.reverb.com"),
        is_enabled=cred.is_enabled
    )


def _build_reverb_headers(api_token: str) -> Dict[str, str]:
    """Build headers for Reverb API requests."""
    return {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/hal+json",
        "Accept": "application/hal+json",
        "Accept-Version": "3.0"
    }


def _parse_order_timestamp(raw_order: Dict[str, Any]) -> Optional[datetime]:
    """
    Parse the order timestamp from a Reverb order for date filtering.
    
    Timestamp priority (as documented in CHUNK 7B.2):
    1. created_at - primary timestamp for when order was created
    2. ordered_at - alternative timestamp
    3. updated_at - fallback timestamp
    
    Returns:
        timezone-aware datetime in UTC, or None if no timestamp found
    """
    # Priority order of timestamp fields
    timestamp_fields = ["created_at", "ordered_at", "updated_at"]
    
    for field in timestamp_fields:
        ts_str = raw_order.get(field)
        if ts_str:
            try:
                # Parse ISO format, handle Z suffix
                if ts_str.endswith("Z"):
                    ts_str = ts_str[:-1] + "+00:00"
                dt = datetime.fromisoformat(ts_str)
                # Ensure timezone-aware (assume UTC if naive)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except (ValueError, AttributeError):
                continue
    
    return None


def fetch_reverb_orders(
    credentials: ReverbCredentials,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    days_back: Optional[int] = None,
    limit: int = 50
) -> FetchResult:
    """
    Fetch orders from Reverb API with proper date filtering.
    
    Date filtering is applied CLIENT-SIDE for reliability, since Reverb API
    date params may not work consistently. Orders are assumed to be returned
    newest-first, enabling early-stop optimization.
    
    Args:
        credentials: Reverb credentials
        date_from: Optional start date (cutoff - orders >= this date are included)
        date_to: Optional end date (orders <= this date are included)
        days_back: Optional number of days back to fetch (alternative to date_from)
        limit: Maximum number of filtered orders to return
        
    Returns:
        FetchResult with orders and metadata for diagnostics
        
    Raises:
        ReverbAPIError: If API request fails
    """
    headers = _build_reverb_headers(credentials.api_token)
    base_url = credentials.base_url.rstrip('/')
    
    # Compute cutoff datetime (timezone-aware UTC)
    cutoff: Optional[datetime] = None
    if date_from:
        cutoff = date_from
        if cutoff.tzinfo is None:
            cutoff = cutoff.replace(tzinfo=timezone.utc)
    elif days_back:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
    
    cutoff_end: Optional[datetime] = None
    if date_to:
        cutoff_end = date_to
        if cutoff_end.tzinfo is None:
            cutoff_end = cutoff_end.replace(tzinfo=timezone.utc)
    
    orders_url = f"{base_url}/api/my/orders/selling"
    
    # Fetch with pagination, apply client-side filtering
    # Reverb API supports: per_page (max 50), page
    # Orders are assumed to be returned newest-first (most recent orders first)
    
    filtered_orders: List[Dict[str, Any]] = []
    raw_fetched_count = 0
    undated_count = 0
    page = 1
    max_pages = 20  # Safety limit to prevent infinite loops
    per_page = 50  # Reverb max per page
    
    # Early stop flag - set when we encounter an order older than cutoff
    should_stop = False
    
    while len(filtered_orders) < limit and page <= max_pages and not should_stop:
        params: Dict[str, Any] = {
            "per_page": per_page,
            "page": page,
        }
        
        # Pass date params to API as hint (may or may not work)
        # Reverb API params: created_start_date, created_end_date
        if cutoff:
            params["created_start_date"] = cutoff.strftime("%Y-%m-%dT%H:%M:%SZ")
        if cutoff_end:
            params["created_end_date"] = cutoff_end.strftime("%Y-%m-%dT%H:%M:%SZ")
        
        try:
            response = requests.get(orders_url, headers=headers, params=params, timeout=30)
            
            if response.status_code == 401:
                raise ReverbAPIError("Unauthorized - invalid or expired token", 401)
            
            if response.status_code == 403:
                raise ReverbAPIError("Forbidden - insufficient permissions", 403)
            
            if not response.ok:
                error_text = response.text[:200] if response.text else f"HTTP {response.status_code}"
                raise ReverbAPIError(f"Reverb API error: {error_text}", response.status_code)
            
            data = response.json()
            
            # Reverb returns orders in an "orders" array
            page_orders = data.get("orders", [])
            
            if not page_orders:
                # No more orders to fetch
                break
            
            raw_fetched_count += len(page_orders)
            
            # Apply client-side date filtering
            for order in page_orders:
                order_ts = _parse_order_timestamp(order)
                
                if order_ts is None:
                    # No timestamp - include but count as undated
                    # Do NOT early-stop based on undated orders
                    undated_count += 1
                    if len(filtered_orders) < limit:
                        filtered_orders.append(order)
                    continue
                
                # Check cutoff (orders >= cutoff are included)
                if cutoff and order_ts < cutoff:
                    # Order is older than cutoff
                    # Since orders are newest-first, we can early-stop
                    # (all subsequent orders will also be older)
                    should_stop = True
                    break
                
                # Check end date (orders <= cutoff_end are included)
                if cutoff_end and order_ts > cutoff_end:
                    # Order is newer than end date, skip but don't stop
                    continue
                
                # Order passes date filters
                if len(filtered_orders) < limit:
                    filtered_orders.append(order)
            
            # Move to next page
            page += 1
            
            # If we got fewer orders than requested, we've reached the end
            if len(page_orders) < per_page:
                break
                
        except requests.exceptions.Timeout:
            raise ReverbAPIError("Request timeout", 408)
        except requests.exceptions.RequestException as e:
            raise ReverbAPIError(f"Connection error: {str(e)}", 0)
    
    pages_fetched = page - 1
    
    # Log filtering stats (no secrets)
    print(f"[REVERB_SERVICE] raw_fetched={raw_fetched_count} filtered={len(filtered_orders)} undated={undated_count} pages={pages_fetched} early_stop={should_stop}")
    
    return FetchResult(
        orders=filtered_orders,
        raw_fetched=raw_fetched_count,
        filtered=len(filtered_orders),
        pages_fetched=pages_fetched,
        early_stop=should_stop,
        undated_count=undated_count,
        filter_since_utc=cutoff.isoformat() if cutoff else None,
        timestamp_field_used="created_at > ordered_at > updated_at"
    )


def fetch_single_reverb_order(credentials: ReverbCredentials) -> Optional[Dict[str, Any]]:
    """
    Fetch a single order from Reverb for mapping validation.
    
    Args:
        credentials: Reverb credentials
        
    Returns:
        Single order dict or None if no orders
    """
    # Fetch without date filter to get any recent order
    result = fetch_reverb_orders(credentials, limit=1)
    return result.orders[0] if result.orders else None


def map_reverb_order_to_schema(raw_order: Dict[str, Any]) -> Dict[str, Any]:
    """
    Map a Reverb order to our normalized MarketplaceOrderCreate schema.
    
    Args:
        raw_order: Raw order dict from Reverb API
        
    Returns:
        Dict compatible with MarketplaceOrderCreate schema
    """
    # Extract order ID (required)
    order_id = str(raw_order.get("order_number") or raw_order.get("id", ""))
    
    # Extract buyer info
    buyer = raw_order.get("buyer", {}) or {}
    
    # Extract price info (Reverb uses amount_product, amount_shipping, etc.)
    # Amounts are usually in dollars, need to convert to cents
    def dollars_to_cents(value: Any) -> Optional[int]:
        if value is None:
            return None
        try:
            return int(float(value) * 100)
        except (ValueError, TypeError):
            return None
    
    amount_product = raw_order.get("amount_product", {}) or {}
    amount_shipping = raw_order.get("amount_shipping", {}) or {}
    amount_tax = raw_order.get("amount_tax", {}) or {}
    amount_total = raw_order.get("amount_total", {}) or {}
    
    # Currency from any amount field
    currency = amount_total.get("currency", "USD") or "USD"
    
    # Order date - use parsed timestamp
    order_ts = _parse_order_timestamp(raw_order)
    order_date_str = raw_order.get("created_at") or raw_order.get("paid_at")
    order_date = order_ts if order_ts else datetime.now(timezone.utc)
    
    # Status mapping
    status_raw = raw_order.get("status", "")
    status_normalized = _map_reverb_status(status_raw)
    
    # Build shipping address
    addresses = []
    shipping_address = raw_order.get("shipping_address")
    if shipping_address:
        addresses.append({
            "address_type": "shipping",
            "name": shipping_address.get("name"),
            "phone": shipping_address.get("phone"),
            "line1": shipping_address.get("street_address"),
            "line2": shipping_address.get("extended_address"),
            "city": shipping_address.get("locality"),
            "state_or_region": shipping_address.get("region"),
            "postal_code": shipping_address.get("postal_code"),
            "country_code": shipping_address.get("country_code"),
            "raw_payload": shipping_address
        })
    
    # Build order lines from product
    lines = []
    product = raw_order.get("product", {}) or {}
    if product:
        line_id = str(product.get("id", "")) or order_id
        lines.append({
            "external_line_item_id": line_id,
            "sku": product.get("sku"),
            "title": product.get("title"),
            "quantity": raw_order.get("quantity", 1),
            "unit_price_cents": dollars_to_cents(amount_product.get("amount")),
            "line_total_cents": dollars_to_cents(amount_product.get("amount")),
            "customization_data": product.get("customization") if product.get("customization") else None,
            "raw_marketplace_data": product
        })
    
    return {
        "source": "api_import",
        "marketplace": "reverb",
        "external_order_id": order_id,
        "external_order_number": raw_order.get("order_number"),
        "order_date": order_date.isoformat() if order_date else None,
        "created_at_external": order_date_str,
        "status_raw": status_raw,
        "status_normalized": status_normalized,
        "buyer_name": buyer.get("full_name") or buyer.get("first_name"),
        "buyer_email": buyer.get("email"),
        "currency_code": currency,
        "items_subtotal_cents": dollars_to_cents(amount_product.get("amount")),
        "shipping_cents": dollars_to_cents(amount_shipping.get("amount")),
        "tax_cents": dollars_to_cents(amount_tax.get("amount")),
        "order_total_cents": dollars_to_cents(amount_total.get("amount")),
        "raw_marketplace_data": raw_order,
        "addresses": addresses,
        "lines": lines,
        "shipments": []
    }


def _map_reverb_status(reverb_status: str) -> str:
    """Map Reverb order status to our normalized status."""
    status_lower = (reverb_status or "").lower()
    
    status_map = {
        "unpaid": "pending",
        "pending_shipment": "processing",
        "shipped": "shipped",
        "picked_up": "shipped",
        "received": "delivered",
        "cancelled": "cancelled",
        "refunded": "cancelled",
    }
    
    return status_map.get(status_lower, "unknown")
