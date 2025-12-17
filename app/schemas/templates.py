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
    attribute_group: Optional[str] = None
    required: bool = False
    order_index: int = 0
    description: Optional[str] = None
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
    keywords: List[ProductTypeKeywordResponse] = []
    fields: List[ProductTypeFieldResponse] = []
    
    class Config:
        from_attributes = True

class TemplateImportResponse(BaseModel):
    product_code: str
    fields_imported: int
    keywords_imported: int
    valid_values_imported: int
