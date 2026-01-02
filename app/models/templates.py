from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, JSON, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime

class AmazonCustomizationTemplate(Base):
    __tablename__ = "amazon_customization_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)
    file_size = Column(Integer, nullable=True)

class EquipmentTypeCustomizationTemplate(Base):
    """
    Join table for multi-template assignment to equipment types.
    Supports up to 3 templates per equipment type via slot-based assignment.
    """
    __tablename__ = "equipment_type_customization_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_type_id = Column(Integer, ForeignKey("equipment_types.id"), nullable=False)
    template_id = Column(Integer, ForeignKey("amazon_customization_templates.id"), nullable=False)
    slot = Column(Integer, nullable=False)  # 1, 2, or 3
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    equipment_type = relationship("EquipmentType")
    template = relationship("AmazonCustomizationTemplate")
    
    __table_args__ = (
        UniqueConstraint('equipment_type_id', 'slot', name='uq_equipment_type_customization_templates_slot'),
        UniqueConstraint('equipment_type_id', 'template_id', name='uq_equipment_type_customization_templates_template'),
    )

class AmazonProductType(Base):
    __tablename__ = "amazon_product_types"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    header_rows = Column(JSON, nullable=True)
    original_filename = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    upload_date = Column(DateTime, nullable=True)
    file_size = Column(Integer, nullable=True)
    
    # Export Configuration
    export_sheet_name_override = Column(String, nullable=True)
    export_start_row_override = Column(Integer, nullable=True)
    export_force_exact_start_row = Column(Boolean, nullable=False, default=False, server_default="0")
    
    keywords = relationship("ProductTypeKeyword", back_populates="product_type", cascade="all, delete-orphan")
    fields = relationship("ProductTypeField", back_populates="product_type", cascade="all, delete-orphan")
    equipment_types = relationship("EquipmentTypeProductType", back_populates="product_type", cascade="all, delete-orphan")


class EquipmentTypeProductType(Base):
    __tablename__ = "equipment_type_product_types"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_type_id = Column(Integer, ForeignKey("equipment_types.id"), nullable=False)
    product_type_id = Column(Integer, ForeignKey("amazon_product_types.id"), nullable=False)
    
    equipment_type = relationship("EquipmentType")
    product_type = relationship("AmazonProductType", back_populates="equipment_types")
    
    __table_args__ = (
        UniqueConstraint('equipment_type_id', name='uq_equipment_type_product_types_equipment_type_id'),
    )

class ProductTypeKeyword(Base):
    __tablename__ = "product_type_keywords"
    
    id = Column(Integer, primary_key=True, index=True)
    product_type_id = Column(Integer, ForeignKey("amazon_product_types.id"), nullable=False)
    keyword = Column(String, nullable=False)
    
    product_type = relationship("AmazonProductType", back_populates="keywords")

class ProductTypeField(Base):
    __tablename__ = "product_type_fields"
    
    id = Column(Integer, primary_key=True, index=True)
    product_type_id = Column(Integer, ForeignKey("amazon_product_types.id"), nullable=False)
    field_name = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    attribute_group = Column(String, nullable=True)
    required = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    selected_value = Column(String, nullable=True)
    custom_value = Column(String, nullable=True)
    
    product_type = relationship("AmazonProductType", back_populates="fields")
    valid_values = relationship("ProductTypeFieldValue", back_populates="field", cascade="all, delete-orphan")

class ProductTypeFieldValue(Base):
    __tablename__ = "product_type_field_values"
    
    id = Column(Integer, primary_key=True, index=True)
    product_type_field_id = Column(Integer, ForeignKey("product_type_fields.id"), nullable=False)
    value = Column(String, nullable=False)
    
    field = relationship("ProductTypeField", back_populates="valid_values")

class EbayTemplate(Base):
    __tablename__ = "ebay_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    sha256 = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    fields = relationship("EbayField", back_populates="ebay_template", cascade="all, delete-orphan")

class EbayField(Base):
    __tablename__ = "ebay_fields"
    
    id = Column(Integer, primary_key=True, index=True)
    ebay_template_id = Column(Integer, ForeignKey("ebay_templates.id"), nullable=False)
    field_name = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    required = Column(Boolean, default=False)
    order_index = Column(Integer, nullable=True)
    selected_value = Column(String, nullable=True)
    custom_value = Column(String, nullable=True)
    
    ebay_template = relationship("EbayTemplate", back_populates="fields")
    valid_values = relationship("EbayFieldValue", back_populates="field", cascade="all, delete-orphan")

class EbayFieldValue(Base):
    __tablename__ = "ebay_field_values"
    
    id = Column(Integer, primary_key=True, index=True)
    ebay_field_id = Column(Integer, ForeignKey("ebay_fields.id"), nullable=False)
    value = Column(String, nullable=False)
    
    field = relationship("EbayField", back_populates="valid_values")
