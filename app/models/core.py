from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.models.enums import HandleLocation, AngleType, Carrier, Marketplace, MaterialType, UnitOfMeasure

class Manufacturer(Base):
    __tablename__ = "manufacturers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    series = relationship("Series", back_populates="manufacturer", cascade="all, delete-orphan")

class Series(Base):
    __tablename__ = "series"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    manufacturer_id = Column(Integer, ForeignKey("manufacturers.id"), nullable=False)
    
    manufacturer = relationship("Manufacturer", back_populates="series")
    models = relationship("Model", back_populates="series", cascade="all, delete-orphan")
    
    __table_args__ = (UniqueConstraint('manufacturer_id', 'name', name='uq_series_manufacturer_name'),)

class EquipmentType(Base):
    __tablename__ = "equipment_types"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    
    models = relationship("Model", back_populates="equipment_type")
    product_types = relationship("EquipmentTypeProductType", back_populates="equipment_type")
    pricing_options = relationship("EquipmentTypePricingOption", back_populates="equipment_type", cascade="all, delete-orphan")
    design_options = relationship("EquipmentTypeDesignOption", back_populates="equipment_type", cascade="all, delete-orphan")

class Model(Base):
    __tablename__ = "models"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    series_id = Column(Integer, ForeignKey("series.id"), nullable=False)
    equipment_type_id = Column(Integer, ForeignKey("equipment_types.id"), nullable=False)
    width = Column(Float, nullable=False)
    depth = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    handle_length = Column(Float, nullable=True)
    handle_width = Column(Float, nullable=True)
    handle_location = Column(Enum(HandleLocation), default=HandleLocation.NO_AMP_HANDLE)
    angle_type = Column(Enum(AngleType), default=AngleType.TOP_ANGLE)
    image_url = Column(String, nullable=True)
    parent_sku = Column(String(40), nullable=True)
    surface_area_sq_in = Column(Float, nullable=True)
    
    series = relationship("Series", back_populates="models")
    equipment_type = relationship("EquipmentType", back_populates="models")
    order_lines = relationship("OrderLine", back_populates="model")
    
    __table_args__ = (UniqueConstraint('series_id', 'name', name='uq_model_series_name'),)

class Material(Base):
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    base_color = Column(String, nullable=False)
    material_type = Column(Enum(MaterialType), default=MaterialType.FABRIC, nullable=False)
    linear_yard_width = Column(Float, nullable=True)
    weight_per_linear_yard = Column(Float, nullable=True)
    unit_of_measure = Column(Enum(UnitOfMeasure), default=UnitOfMeasure.YARD, nullable=True)
    package_quantity = Column(Float, nullable=True)
    weight_per_sq_in_oz = Column(Float, nullable=True)
    
    colour_surcharges = relationship("MaterialColourSurcharge", back_populates="material", cascade="all, delete-orphan")
    supplier_materials = relationship("SupplierMaterial", back_populates="material", cascade="all, delete-orphan")
    order_lines = relationship("OrderLine", back_populates="material")

class MaterialColourSurcharge(Base):
    __tablename__ = "material_colour_surcharges"
    
    id = Column(Integer, primary_key=True, index=True)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    colour = Column(String, nullable=False)
    surcharge = Column(Float, nullable=False)
    
    material = relationship("Material", back_populates="colour_surcharges")

class Supplier(Base):
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    contact_name = Column(String, nullable=True)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    website = Column(String, nullable=True)
    
    supplier_materials = relationship("SupplierMaterial", back_populates="supplier", cascade="all, delete-orphan")

class SupplierMaterial(Base):
    __tablename__ = "supplier_materials"
    
    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    unit_cost = Column(Float, nullable=False)
    shipping_cost = Column(Float, default=0.0)
    quantity_purchased = Column(Float, default=1.0)
    is_preferred = Column(Boolean, default=False)
    
    supplier = relationship("Supplier", back_populates="supplier_materials")
    material = relationship("Material", back_populates="supplier_materials")
    
    __table_args__ = (UniqueConstraint('supplier_id', 'material_id', name='uq_supplier_material'),)

class Customer(Base):
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    orders = relationship("Order", back_populates="customer", cascade="all, delete-orphan")

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    marketplace = Column(Enum(Marketplace), nullable=True)
    marketplace_order_number = Column(String, nullable=True)
    order_date = Column(DateTime, default=datetime.utcnow)
    
    customer = relationship("Customer", back_populates="orders")
    order_lines = relationship("OrderLine", back_populates="order", cascade="all, delete-orphan")

class OrderLine(Base):
    __tablename__ = "order_lines"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    colour = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    handle_zipper = Column(Boolean, default=False)
    two_in_one_pocket = Column(Boolean, default=False)
    music_rest_zipper = Column(Boolean, default=False)
    unit_price = Column(Float, nullable=True)
    
    order = relationship("Order", back_populates="order_lines")
    model = relationship("Model", back_populates="order_lines")
    material = relationship("Material", back_populates="order_lines")

class PricingOption(Base):
    __tablename__ = "pricing_options"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    price = Column(Float, nullable=False)
    
    equipment_types = relationship("EquipmentTypePricingOption", back_populates="pricing_option")

class EquipmentTypePricingOption(Base):
    __tablename__ = "equipment_type_pricing_options"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_type_id = Column(Integer, ForeignKey("equipment_types.id"), nullable=False)
    pricing_option_id = Column(Integer, ForeignKey("pricing_options.id"), nullable=False)
    
    equipment_type = relationship("EquipmentType", back_populates="pricing_options")
    pricing_option = relationship("PricingOption", back_populates="equipment_types")
    
    __table_args__ = (UniqueConstraint('equipment_type_id', 'pricing_option_id', name='uq_equip_type_pricing_option'),)

class ShippingRate(Base):
    __tablename__ = "shipping_rates"
    
    id = Column(Integer, primary_key=True, index=True)
    carrier = Column(Enum(Carrier), nullable=False)
    min_weight = Column(Float, nullable=False)
    max_weight = Column(Float, nullable=False)
    zone = Column(String, nullable=False)
    rate = Column(Float, nullable=False)
    surcharge = Column(Float, default=0.0)

class DesignOption(Base):
    __tablename__ = "design_options"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    
    equipment_types = relationship("EquipmentTypeDesignOption", back_populates="design_option")

class EquipmentTypeDesignOption(Base):
    __tablename__ = "equipment_type_design_options"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_type_id = Column(Integer, ForeignKey("equipment_types.id"), nullable=False)
    design_option_id = Column(Integer, ForeignKey("design_options.id"), nullable=False)
    
    equipment_type = relationship("EquipmentType", back_populates="design_options")
    design_option = relationship("DesignOption", back_populates="equipment_types")
    
    __table_args__ = (UniqueConstraint('equipment_type_id', 'design_option_id', name='uq_equip_type_design_option'),)

class MaterialRoleAssignment(Base):
    __tablename__ = "material_role_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, nullable=False)
    material_id = Column(Integer, ForeignKey("materials.id"), nullable=False)
    effective_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    material = relationship("Material")
    
    __table_args__ = (
        # Index for fast lookup of active roles
        # In SQLite/others, we often just index the columns. 
        # For effective dating, (role, end_date) is useful.
        # We'll rely on simple indexing for now.
    )

class ShippingRateCard(Base):
    __tablename__ = "shipping_rate_cards"
    
    id = Column(Integer, primary_key=True, index=True)
    carrier = Column(Enum(Carrier), nullable=False)
    name = Column(String, nullable=False)
    effective_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    
    tiers = relationship("ShippingRateTier", back_populates="rate_card", cascade="all, delete-orphan")
    zone_rates = relationship("ShippingZoneRate", back_populates="rate_card", cascade="all, delete-orphan")

class ShippingRateTier(Base):
    __tablename__ = "shipping_rate_tiers"
    
    id = Column(Integer, primary_key=True, index=True)
    rate_card_id = Column(Integer, ForeignKey("shipping_rate_cards.id"), nullable=False)
    min_oz = Column(Float, nullable=False) # DECIMAL(10,4) handled as Float in SQLite for simplicity/compat
    max_oz = Column(Float, nullable=False)
    label = Column(String, nullable=True)
    
    rate_card = relationship("ShippingRateCard", back_populates="tiers")
    zone_rates = relationship("ShippingZoneRate", back_populates="tier", cascade="all, delete-orphan")

class ShippingZoneRate(Base):
    __tablename__ = "shipping_zone_rates"
    
    id = Column(Integer, primary_key=True, index=True)
    rate_card_id = Column(Integer, ForeignKey("shipping_rate_cards.id"), nullable=False)
    tier_id = Column(Integer, ForeignKey("shipping_rate_tiers.id"), nullable=False)
    zone = Column(Integer, nullable=False)
    rate_cents = Column(Integer, nullable=False)
    
    rate_card = relationship("ShippingRateCard", back_populates="zone_rates")
    tier = relationship("ShippingRateTier", back_populates="zone_rates")
    
    __table_args__ = (UniqueConstraint('tier_id', 'zone', name='uq_tier_zone'),)

class MarketplaceShippingProfile(Base):
    __tablename__ = "marketplace_shipping_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    marketplace = Column(String, nullable=False, default="DEFAULT")
    rate_card_id = Column(Integer, ForeignKey("shipping_rate_cards.id"), nullable=False)
    pricing_zone = Column(Integer, nullable=False)
    effective_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    
    rate_card = relationship("ShippingRateCard")

class LaborSetting(Base):
    __tablename__ = "labor_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    hourly_rate_cents = Column(Integer, default=1700)
    minutes_no_padding = Column(Integer, default=35)
    minutes_with_padding = Column(Integer, default=60)

class VariantProfitSetting(Base):
    __tablename__ = "variant_profit_settings"
    
    variant_key = Column(String, primary_key=True)
    profit_cents = Column(Integer, nullable=False)

class MarketplaceFeeRate(Base):
    __tablename__ = "marketplace_fee_rates"
    
    marketplace = Column(String, primary_key=True)
    fee_rate = Column(Float, nullable=False) # DECIMAL(6,5)

class ModelPricingSnapshot(Base):
    __tablename__ = "model_pricing_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)
    marketplace = Column(String, nullable=False, default="DEFAULT")
    variant_key = Column(String, nullable=False)
    
    raw_cost_cents = Column(Integer, nullable=False)
    base_cost_cents = Column(Integer, nullable=False)
    retail_price_cents = Column(Integer, nullable=False)
    marketplace_fee_cents = Column(Integer, nullable=False)
    profit_cents = Column(Integer, nullable=False)
    
    material_cost_cents = Column(Integer, nullable=False)
    shipping_cost_cents = Column(Integer, nullable=False)
    labor_cost_cents = Column(Integer, nullable=False)
    weight_oz = Column(Float, nullable=False)
    
    calculated_at = Column(DateTime, default=datetime.utcnow)
    
    model = relationship("Model")
    
    __table_args__ = (UniqueConstraint('model_id', 'marketplace', 'variant_key', name='uq_model_mp_variant'),)
