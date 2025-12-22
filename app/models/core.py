from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
from app.models.enums import HandleLocation, AngleType, Carrier, Marketplace

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
    
    series = relationship("Series", back_populates="models")
    equipment_type = relationship("EquipmentType", back_populates="models")
    order_lines = relationship("OrderLine", back_populates="model")
    
    __table_args__ = (UniqueConstraint('series_id', 'name', name='uq_model_series_name'),)

class Material(Base):
    __tablename__ = "materials"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    base_color = Column(String, nullable=False)
    linear_yard_width = Column(Float, nullable=False)
    cost_per_linear_yard = Column(Float, nullable=False)
    weight_per_linear_yard = Column(Float, nullable=False)
    labor_time_minutes = Column(Float, nullable=False)
    
    colour_surcharges = relationship("MaterialColourSurcharge", back_populates="material", cascade="all, delete-orphan")
    supplier_materials = relationship("SupplierMaterial", back_populates="material")
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
