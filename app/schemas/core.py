from pydantic import BaseModel
from typing import Optional, List, Dict, Union
from datetime import datetime
from app.models.enums import HandleLocation, AngleType, Carrier, Marketplace, MaterialType, UnitOfMeasure

class ManufacturerBase(BaseModel):
    name: str

class ManufacturerCreate(ManufacturerBase):
    pass

class ManufacturerResponse(ManufacturerBase):
    id: int
    
    class Config:
        from_attributes = True

class SeriesBase(BaseModel):
    name: str
    manufacturer_id: int

class SeriesCreate(SeriesBase):
    pass

class SeriesResponse(SeriesBase):
    id: int
    
    class Config:
        from_attributes = True

class AmazonCustomizationTemplateResponse(BaseModel):
    id: int
    original_filename: str
    class Config:
        from_attributes = True

class AmazonCustomizationTemplatePreviewResponse(BaseModel):
    template_id: int
    original_filename: str
    sheet_name: str
    max_row: int
    max_column: int
    preview_row_count: int
    preview_column_count: int
    grid: List[List[str]]

    class Config:
        from_attributes = True

class AmazonCustomizationTemplateAssignmentRequest(BaseModel):
    template_id: Optional[int] = None

# Multi-template assignment schemas (slot-based)
class EquipmentTypeCustomizationTemplateAssignRequest(BaseModel):
    """Request to assign a template to a specific slot (1-3) for an equipment type."""
    template_id: int
    slot: int  # 1, 2, or 3

class EquipmentTypeCustomizationTemplateItem(BaseModel):
    """Single template assignment in a slot."""
    template_id: int
    slot: int
    original_filename: str
    upload_date: datetime
    
    class Config:
        from_attributes = True

class EquipmentTypeCustomizationTemplatesResponse(BaseModel):
    """Response showing all assigned templates (up to 3) for an equipment type."""
    equipment_type_id: int
    templates: List[EquipmentTypeCustomizationTemplateItem]
    default_template_id: Optional[int] = None

class EquipmentTypeCustomizationTemplateSetDefaultRequest(BaseModel):
    """Request to set one of the assigned templates as the default."""
    template_id: int


class EquipmentTypeBase(BaseModel):
    name: str

class EquipmentTypeCreate(EquipmentTypeBase):
    pass

class EquipmentTypeResponse(EquipmentTypeBase):
    id: int
    amazon_customization_template_id: Optional[int] = None
    amazon_customization_template: Optional[AmazonCustomizationTemplateResponse] = None

    class Config:
        from_attributes = True

class AmazonAPlusContentBase(BaseModel):
    content_type: str
    is_uploaded: bool = False
    notes: Optional[str] = None

class AmazonAPlusContentCreate(AmazonAPlusContentBase):
    pass

class AmazonAPlusContentResponse(AmazonAPlusContentBase):
    id: int
    model_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ModelBase(BaseModel):
    name: str
    series_id: int
    equipment_type_id: int
    width: float
    depth: float
    height: float
    handle_length: Optional[float] = None
    handle_width: Optional[float] = None
    handle_location: HandleLocation = HandleLocation.NO_AMP_HANDLE
    angle_type: AngleType = AngleType.NO_ANGLE
    image_url: Optional[str] = None
    sku_override: Optional[str] = None
    top_depth_in: Optional[float] = None
    angle_drop_in: Optional[float] = None
    handle_location_option_id: Optional[int] = None
    angle_type_option_id: Optional[int] = None
    top_handle_length_in: Optional[float] = None
    top_handle_height_in: Optional[float] = None
    top_handle_rear_edge_to_center_in: Optional[float] = None
    model_notes: Optional[str] = None
    exclude_from_amazon_export: bool = False
    exclude_from_ebay_export: bool = False
    exclude_from_reverb_export: bool = False
    exclude_from_etsy_export: bool = False

class MarketplaceListingBase(BaseModel):
    marketplace: str
    external_id: str
    listing_url: Optional[str] = None

class MarketplaceListingCreate(MarketplaceListingBase):
    pass

class MarketplaceListingResponse(MarketplaceListingBase):
    id: int
    model_id: int
    status: Optional[str] = None
    parent_external_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ModelCreate(ModelBase):
    marketplace_listings: Optional[List[MarketplaceListingCreate]] = []
    amazon_a_plus_content: Optional[List[AmazonAPlusContentCreate]] = []

class ModelResponse(ModelBase):
    id: int
    parent_sku: Optional[str] = None
    surface_area_sq_in: Optional[float] = None
    marketplace_listings: List[MarketplaceListingResponse] = []
    amazon_a_plus_content: List[AmazonAPlusContentResponse] = []
    
    class Config:
        from_attributes = True

class MaterialBase(BaseModel):
    name: str
    base_color: str
    material_type: MaterialType = MaterialType.FABRIC
    linear_yard_width: Optional[float] = None
    weight_per_linear_yard: Optional[float] = None
    unit_of_measure: Optional[UnitOfMeasure] = UnitOfMeasure.YARD
    package_quantity: Optional[float] = None
    sku_abbreviation: Optional[str] = None
    ebay_variation_enabled: bool = False

class MaterialCreate(MaterialBase):
    pass

class MaterialResponse(MaterialBase):
    id: int
    
    class Config:
        from_attributes = True

class MaterialColourSurchargeBase(BaseModel):
    material_id: int
    colour: str
    surcharge: float
    color_friendly_name: Optional[str] = None
    sku_abbreviation: Optional[str] = None
    ebay_variation_enabled: bool = False

class MaterialColourSurchargeCreate(MaterialColourSurchargeBase):
    pass

class MaterialColourSurchargeResponse(MaterialColourSurchargeBase):
    id: int
    
    class Config:
        from_attributes = True

class SupplierBase(BaseModel):
    name: str
    contact_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None

class SupplierCreate(SupplierBase):
    pass

class SupplierResponse(SupplierBase):
    id: int
    
    class Config:
        from_attributes = True

class SupplierMaterialBase(BaseModel):
    supplier_id: int
    material_id: int
    unit_cost: float
    shipping_cost: float = 0.0
    quantity_purchased: float = 1.0
    is_preferred: bool = False

class SupplierMaterialCreate(SupplierMaterialBase):
    pass

class SupplierMaterialResponse(SupplierMaterialBase):
    id: int
    
    class Config:
        from_attributes = True

class SupplierMaterialWithSupplierResponse(BaseModel):
    id: int
    supplier_id: int
    material_id: int
    unit_cost: float
    shipping_cost: float
    quantity_purchased: float
    is_preferred: bool
    supplier_name: str
    material_type: Optional[MaterialType] = None
    cost_per_linear_yard: float = 0.0
    cost_per_square_inch: float = 0.0
    
    class Config:
        from_attributes = True

class SupplierMaterialWithMaterialResponse(BaseModel):
    id: int
    supplier_id: int
    material_id: int
    unit_cost: float
    shipping_cost: float
    quantity_purchased: float
    is_preferred: bool
    material_name: str
    material_type: Optional[MaterialType] = None
    linear_yard_width: Optional[float] = None
    cost_per_linear_yard: float = 0.0
    cost_per_square_inch: float = 0.0
    
    class Config:
        from_attributes = True

class SetPreferredSupplierRequest(BaseModel):
    supplier_id: int

class CustomerBase(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    id: int
    
    class Config:
        from_attributes = True

class OrderLineBase(BaseModel):
    model_id: int
    material_id: int
    colour: Optional[str] = None
    quantity: int = 1
    handle_zipper: bool = False
    two_in_one_pocket: bool = False
    music_rest_zipper: bool = False
    unit_price: Optional[float] = None

class OrderLineCreate(OrderLineBase):
    pass

class OrderLineResponse(OrderLineBase):
    id: int
    order_id: int
    
    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    customer_id: int
    marketplace: Optional[Marketplace] = None
    marketplace_order_number: Optional[str] = None

class OrderCreate(OrderBase):
    order_lines: List[OrderLineCreate] = []

class OrderResponse(OrderBase):
    id: int
    order_date: datetime
    order_lines: List[OrderLineResponse] = []
    
    class Config:
        from_attributes = True

class PricingOptionBase(BaseModel):
    name: str
    price: float

class PricingOptionCreate(PricingOptionBase):
    pass

class PricingOptionResponse(PricingOptionBase):
    id: int
    
    class Config:
        from_attributes = True

class ShippingRateBase(BaseModel):
    carrier: Carrier
    min_weight: float
    max_weight: float
    zone: str
    rate: float
    surcharge: float = 0.0

class ShippingRateCreate(ShippingRateBase):
    pass

class ShippingRateResponse(ShippingRateBase):
    id: int
    
    class Config:
        from_attributes = True

class PricingCalculateRequest(BaseModel):
    model_id: int
    material_id: int
    colour: Optional[str] = None
    quantity: int = 1
    handle_zipper: bool = False
    two_in_one_pocket: bool = False
    music_rest_zipper: bool = False
    carrier: Optional[Carrier] = Carrier.USPS
    zone: Optional[str] = "1"

class PricingCalculateResponse(BaseModel):
    area: float
    waste_area: float
    material_cost: float
    colour_surcharge: float
    option_surcharge: float
    weight: float
    shipping_cost: float
    unit_total: float
    total: float

class DesignOptionBase(BaseModel):
    name: str
    description: Optional[str] = None
    option_type: str
    is_pricing_relevant: bool = False
    equipment_type_ids: List[int] = []
    sku_abbreviation: Optional[str] = None
    ebay_variation_enabled: bool = False

class DesignOptionCreate(DesignOptionBase):
    pass

class DesignOptionResponse(DesignOptionBase):
    id: int
    
    class Config:
        from_attributes = True

# Settings Schemas

class MaterialRoleAssignmentCreate(BaseModel):
    role: str
    material_id: int
    effective_date: Optional[datetime] = None

class MaterialRoleAssignmentResponse(MaterialRoleAssignmentCreate):
    id: int
    end_date: Optional[datetime] = None
    created_at: datetime
    
    class Config:
         from_attributes = True

class ShippingZoneResponse(BaseModel):
    id: int
    code: str
    name: str
    sort_order: Optional[int] = 0
    active: bool
    
    class Config:
        from_attributes = True

class ShippingRateCardCreate(BaseModel):
    name: str # Only allow name. Carrier is defaulted by backend.
    effective_date: Optional[datetime] = None
    active: bool = True

    class Config:
        extra = "forbid"


class ShippingRateCardUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None

class ShippingRateCardResponse(ShippingRateCardCreate):
    id: int
    end_date: Optional[datetime] = None
    active: bool
    
    class Config:
        from_attributes = True

class ShippingRateTierCreate(BaseModel):
    rate_card_id: int
    min_oz: float
    max_oz: float
    label: Optional[str] = None
    active: bool = True

class ShippingRateTierUpdate(BaseModel):
    label: Optional[str] = None
    max_weight_oz: Optional[float] = None
    active: Optional[bool] = None

class TierCreateRequest(BaseModel):
    label: Optional[str] = None
    max_weight_oz: float

class ShippingRateTierResponse(ShippingRateTierCreate):
    id: int
    active: bool
    class Config:
        from_attributes = True

class ShippingZoneRateCreate(BaseModel):
    rate_card_id: int
    tier_id: int
    zone: int
    rate_cents: int

class ShippingZoneRateResponse(ShippingZoneRateCreate):
    id: int
    class Config:
        from_attributes = True

class ShippingZoneRateNormalizedResponse(BaseModel):
    zone_id: int
    zone_code: str
    zone_name: str
    rate_cents: Optional[int]
    zone_rate_id: Optional[int]

class ShippingZoneRateUpsertRequest(BaseModel):
    rate_cents: Optional[int]

class MarketplaceShippingProfileCreate(BaseModel):
    marketplace: str
    rate_card_id: int
    pricing_zone: int
    effective_date: Optional[datetime] = None

class MarketplaceShippingProfileResponse(MarketplaceShippingProfileCreate):
    id: int
    end_date: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ShippingDefaultSettingCreate(BaseModel):
    shipping_mode: str = "calculated" # "flat", "calculated", "fixed_cell"
    flat_shipping_cents: int = 0
    default_rate_card_id: Optional[int] = None
    default_zone_code: Optional[str] = None
    assumed_rate_card_id: Optional[int] = None
    assumed_tier_id: Optional[int] = None
    assumed_zone_code: Optional[str] = None

class ShippingDefaultSettingResponse(ShippingDefaultSettingCreate):
    id: int
    shipping_settings_version: int
    
    class Config:
        from_attributes = True

class LaborSettingCreate(BaseModel):
    hourly_rate_cents: int
    minutes_no_padding: int
    minutes_with_padding: int

class LaborSettingResponse(LaborSettingCreate):
    id: int
    class Config:
        from_attributes = True

class MarketplaceFeeRateCreate(BaseModel):
    marketplace: str
    fee_rate: float

class MarketplaceFeeRateResponse(MarketplaceFeeRateCreate):
    class Config:
        from_attributes = True

class VariantProfitSettingCreate(BaseModel):
    variant_key: str
    profit_cents: int

class VariantProfitSettingResponse(VariantProfitSettingCreate):
    class Config:
        from_attributes = True

class ExportSettingCreate(BaseModel):
    default_save_path_template: Optional[str] = None
    amazon_customization_export_format: Optional[str] = "xlsx"

class ExportSettingResponse(ExportSettingCreate):
    id: int
    class Config:
        from_attributes = True

class ModelPricingSnapshotResponse(BaseModel):
    id: int
    model_id: int
    marketplace: str
    variant_key: str
    raw_cost_cents: int
    base_cost_cents: int
    retail_price_cents: int
    marketplace_fee_cents: int
    profit_cents: int
    material_cost_cents: int
    shipping_cost_cents: int
    labor_cost_cents: int
    weight_oz: float
    
    # New Tooltip Metadata
    surface_area_sq_in: Optional[float] = None
    material_cost_per_sq_in_cents: Optional[int] = None
    labor_minutes: Optional[int] = None
    labor_rate_cents_per_hour: Optional[int] = None
    marketplace_fee_rate: Optional[float] = None
    
    calculated_at: datetime
    
    class Config:
        from_attributes = True

class ModelPricingHistoryResponse(BaseModel):
    id: int
    model_id: int
    marketplace: str
    variant_key: str
    
    raw_cost_cents: int
    base_cost_cents: int
    retail_price_cents: int
    marketplace_fee_cents: int
    profit_cents: int
    material_cost_cents: int
    shipping_cost_cents: int
    labor_cost_cents: int
    weight_oz: float
    
    # New Tooltip Metadata
    surface_area_sq_in: Optional[float] = None
    material_cost_per_sq_in_cents: Optional[int] = None
    labor_minutes: Optional[int] = None
    labor_rate_cents_per_hour: Optional[int] = None
    marketplace_fee_rate: Optional[float] = None
    
    calculated_at: datetime
    pricing_context_hash: Optional[str] = None
    reason: Optional[str] = None
    
    class Config:
        from_attributes = True

class PricingRecalculateBulkRequest(BaseModel):
    marketplaces: List[str] = ["amazon"]
    scope: str  # "manufacturer" | "series" | "models"
    manufacturer_id: Optional[int] = None
    series_id: Optional[int] = None
    model_ids: Optional[List[int]] = None
    variant_set: str = "baseline4"
    dry_run: bool = False

class PricingRecalculateResult(BaseModel):
    model_id: int
    error: Optional[str] = None

class PricingRecalculateBulkResponse(BaseModel):
    marketplaces: List[str]
    scope: str
    resolved_model_count: int
    results: Dict[str, Dict[str, List[Union[int, PricingRecalculateResult]]]] 
    # structure: { "amazon": { "succeeded": [1, 2], "failed": [{ "model_id": 3, "error": "msg" }] } }


class ExportStatsResponse(BaseModel):
    total_models: int
    models_with_pricing: int
    models_missing_pricing: int
    models_with_images: int
    models_missing_images: int
    equipment_types: Dict[str, int]

# eBay Variation SKU Schemas
class ModelVariationSKUBase(BaseModel):
    model_id: int
    variation_sku: str
    material_id: Optional[int] = None
    color_id: Optional[int] = None
    design_option_ids: Optional[List[int]] = None
    is_parent: bool = False
    retail_price_cents: Optional[int] = None

class ModelVariationSKUCreate(ModelVariationSKUBase):
    pass

class ModelVariationSKUResponse(ModelVariationSKUBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ============================================================
# Material Role Config Schemas
# ============================================================

class MaterialRoleConfigBase(BaseModel):
    role: str
    display_name: Optional[str] = None
    sku_abbrev_no_padding: Optional[str] = None
    sku_abbrev_with_padding: Optional[str] = None
    ebay_variation_enabled: bool = False
    sort_order: int = 0


class MaterialRoleConfigCreate(MaterialRoleConfigBase):
    pass


class MaterialRoleConfigUpdate(BaseModel):
    display_name: Optional[str] = None
    sku_abbrev_no_padding: Optional[str] = None
    sku_abbrev_with_padding: Optional[str] = None
    ebay_variation_enabled: Optional[bool] = None
    sort_order: Optional[int] = None


class MaterialRoleConfigResponse(MaterialRoleConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============================================================
# Material Role Assignment Schemas
# ============================================================

class MaterialRoleAssignmentBase(BaseModel):
    role: str
    material_id: int
    effective_date: Optional[datetime] = None


class MaterialRoleAssignmentCreate(MaterialRoleAssignmentBase):
    auto_end_previous: bool = True  # Auto-end previous active assignment for same role


class MaterialRoleAssignmentResponse(MaterialRoleAssignmentBase):
    id: int
    end_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


