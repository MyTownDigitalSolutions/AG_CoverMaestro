from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.enums import HandleLocation, AngleType, Carrier, Marketplace

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

class EquipmentTypeBase(BaseModel):
    name: str

class EquipmentTypeCreate(EquipmentTypeBase):
    pass

class EquipmentTypeResponse(EquipmentTypeBase):
    id: int
    
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
    angle_type: AngleType = AngleType.TOP_ANGLE
    image_url: Optional[str] = None

class ModelCreate(ModelBase):
    pass

class ModelResponse(ModelBase):
    id: int
    parent_sku: Optional[str] = None
    
    class Config:
        from_attributes = True

class MaterialBase(BaseModel):
    name: str
    base_color: str
    linear_yard_width: float
    cost_per_linear_yard: float
    weight_per_linear_yard: float
    labor_time_minutes: float

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
    is_preferred: bool
    supplier_name: str
    
    class Config:
        from_attributes = True

class SupplierMaterialWithMaterialResponse(BaseModel):
    id: int
    supplier_id: int
    material_id: int
    unit_cost: float
    shipping_cost: float
    is_preferred: bool
    material_name: str
    
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
    labour_cost: float
    option_surcharge: float
    weight: float
    shipping_cost: float
    unit_total: float
    total: float

class DesignOptionBase(BaseModel):
    name: str
    description: Optional[str] = None

class DesignOptionCreate(DesignOptionBase):
    pass

class DesignOptionResponse(DesignOptionBase):
    id: int
    
    class Config:
        from_attributes = True
