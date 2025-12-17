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
    uses_handle_options: bool = False
    uses_angle_options: bool = False

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
    handle_location: HandleLocation = HandleLocation.NONE
    angle_type: AngleType = AngleType.NONE
    image_url: Optional[str] = None

class ModelCreate(ModelBase):
    pass

class ModelResponse(ModelBase):
    id: int
    
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

class SupplierMaterialCreate(SupplierMaterialBase):
    pass

class SupplierMaterialResponse(SupplierMaterialBase):
    id: int
    
    class Config:
        from_attributes = True

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
