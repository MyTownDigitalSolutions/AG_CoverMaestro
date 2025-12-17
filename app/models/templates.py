from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class AmazonProductType(Base):
    __tablename__ = "amazon_product_types"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    header_rows = Column(JSON, nullable=True)
    
    keywords = relationship("ProductTypeKeyword", back_populates="product_type", cascade="all, delete-orphan")
    fields = relationship("ProductTypeField", back_populates="product_type", cascade="all, delete-orphan")
    equipment_types = relationship("EquipmentTypeProductType", back_populates="product_type", cascade="all, delete-orphan")


class EquipmentTypeProductType(Base):
    __tablename__ = "equipment_type_product_types"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_type_id = Column(Integer, ForeignKey("equipment_types.id"), nullable=False)
    product_type_id = Column(Integer, ForeignKey("amazon_product_types.id"), nullable=False)
    
    equipment_type = relationship("EquipmentType", back_populates="product_types")
    product_type = relationship("AmazonProductType", back_populates="equipment_types")

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
    
    product_type = relationship("AmazonProductType", back_populates="fields")
    valid_values = relationship("ProductTypeFieldValue", back_populates="field", cascade="all, delete-orphan")

class ProductTypeFieldValue(Base):
    __tablename__ = "product_type_field_values"
    
    id = Column(Integer, primary_key=True, index=True)
    product_type_field_id = Column(Integer, ForeignKey("product_type_fields.id"), nullable=False)
    value = Column(String, nullable=False)
    
    field = relationship("ProductTypeField", back_populates="valid_values")
