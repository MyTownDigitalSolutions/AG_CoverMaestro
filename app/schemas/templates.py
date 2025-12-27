from pydantic import BaseModel
from typing import Optional, List

class ProductTypeFieldValueResponse(BaseModel):
    id: int
    value: str
    
    class Config:
        from_attributes = True

class ProductTypeFieldResponse(BaseModel):
    id: int
    field_name: str
    display_name: Optional[str] = None
    attribute_group: Optional[str] = None
    required: bool = False
    order_index: int = 0
    description: Optional[str] = None
    selected_value: Optional[str] = None
    custom_value: Optional[str] = None
    valid_values: List[ProductTypeFieldValueResponse] = []
    
    class Config:
        from_attributes = True

class ProductTypeKeywordResponse(BaseModel):
    id: int
    keyword: str
    
    class Config:
        from_attributes = True

class AmazonProductTypeResponse(BaseModel):
    id: int
    code: str
    name: Optional[str] = None
    description: Optional[str] = None
    header_rows: Optional[List[List[Optional[str]]]] = None
    keywords: List[ProductTypeKeywordResponse] = []
    fields: List[ProductTypeFieldResponse] = []
    
    class Config:
        from_attributes = True

class TemplateImportResponse(BaseModel):
    product_code: str
    fields_imported: int
    keywords_imported: int
    valid_values_imported: int

class EquipmentTypeProductTypeLinkCreate(BaseModel):
    equipment_type_id: int
    product_type_id: int

class EquipmentTypeProductTypeLinkResponse(BaseModel):
    id: int
    equipment_type_id: int
    product_type_id: int
    
    class Config:
        from_attributes = True

class ProductTypeFieldUpdate(BaseModel):
    required: Optional[bool] = None
    selected_value: Optional[str] = None

class ProductTypeFieldValueCreate(BaseModel):
    value: str

class AmazonProductTypeTemplatePreviewResponse(BaseModel):
    product_code: str
    original_filename: str
    sheet_name: str
    max_row: int
    max_column: int
    preview_row_count: int
    preview_column_count: int
    grid: List[List[str]]
