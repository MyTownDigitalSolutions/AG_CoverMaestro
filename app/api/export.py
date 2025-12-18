from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.database import get_db
from app.models.core import Model, Series, Manufacturer, EquipmentType
from app.models.templates import AmazonProductType, ProductTypeField, EquipmentTypeProductType

router = APIRouter(prefix="/export", tags=["export"])

class ExportPreviewRequest(BaseModel):
    model_ids: List[int]
    listing_type: str = "individual"  # "individual" or "parent_child"

class ExportRowData(BaseModel):
    model_id: int
    model_name: str
    data: List[str | None]

class ExportPreviewResponse(BaseModel):
    headers: List[List[str | None]]
    rows: List[ExportRowData]
    template_code: str

@router.post("/preview", response_model=ExportPreviewResponse)
def generate_export_preview(request: ExportPreviewRequest, db: Session = Depends(get_db)):
    if not request.model_ids:
        raise HTTPException(status_code=400, detail="No models selected")
    
    models = db.query(Model).filter(Model.id.in_(request.model_ids)).all()
    if not models:
        raise HTTPException(status_code=404, detail="No models found")
    
    equipment_type_ids = set(m.equipment_type_id for m in models)
    if len(equipment_type_ids) > 1:
        raise HTTPException(
            status_code=400, 
            detail="All selected models must have the same equipment type for export"
        )
    
    equipment_type_id = list(equipment_type_ids)[0]
    
    link = db.query(EquipmentTypeProductType).filter(
        EquipmentTypeProductType.equipment_type_id == equipment_type_id
    ).first()
    
    if not link:
        equipment_type = db.query(EquipmentType).filter(EquipmentType.id == equipment_type_id).first()
        raise HTTPException(
            status_code=400, 
            detail=f"No Amazon template linked to equipment type: {equipment_type.name if equipment_type else 'Unknown'}"
        )
    
    product_type = db.query(AmazonProductType).filter(
        AmazonProductType.id == link.product_type_id
    ).first()
    
    if not product_type:
        raise HTTPException(status_code=404, detail="Template not found")
    
    fields = db.query(ProductTypeField).filter(
        ProductTypeField.product_type_id == product_type.id
    ).order_by(ProductTypeField.order_index).all()
    
    header_rows = product_type.header_rows or []
    
    equipment_type = db.query(EquipmentType).filter(EquipmentType.id == equipment_type_id).first()
    
    rows = []
    for model in models:
        series = db.query(Series).filter(Series.id == model.series_id).first()
        manufacturer = db.query(Manufacturer).filter(Manufacturer.id == series.manufacturer_id).first() if series else None
        
        row_data: List[str | None] = []
        for field in fields:
            value = get_field_value(field, model, series, manufacturer, equipment_type, request.listing_type)
            row_data.append(value)
        
        rows.append(ExportRowData(
            model_id=model.id,
            model_name=model.name,
            data=row_data
        ))
    
    return ExportPreviewResponse(
        headers=header_rows,
        rows=rows,
        template_code=product_type.code
    )

def substitute_placeholders(value: str, model: Model, series, manufacturer, equipment_type) -> str:
    result = value
    # Support both uppercase and mixed-case placeholder formats
    mfr_name = manufacturer.name if manufacturer else ''
    series_name = series.name if series else ''
    model_name = model.name if model else ''
    equip_type = equipment_type.name if equipment_type else ''
    
    # Uppercase format (from imported templates)
    result = result.replace('[MANUFACTURER_NAME]', mfr_name)
    result = result.replace('[SERIES_NAME]', series_name)
    result = result.replace('[MODEL_NAME]', model_name)
    result = result.replace('[EQUIPMENT_TYPE]', equip_type)
    
    # Mixed-case format (legacy support)
    result = result.replace('[Manufacturer_Name]', mfr_name)
    result = result.replace('[Series_Name]', series_name)
    result = result.replace('[Model_Name]', model_name)
    result = result.replace('[Equipment_Type]', equip_type)
    
    return result

def get_field_value(field: ProductTypeField, model: Model, series, manufacturer, equipment_type=None, listing_type: str = "individual") -> str | None:
    field_name_lower = field.field_name.lower()
    
    # Handle contribution_sku for individual listings - use parent_sku
    if 'contribution_sku' in field_name_lower and listing_type == 'individual':
        return model.parent_sku if model.parent_sku else None
    
    if field.custom_value:
        return substitute_placeholders(field.custom_value, model, series, manufacturer, equipment_type)
    
    if field.selected_value:
        return field.selected_value
    
    if 'item_name' in field_name_lower or 'product_name' in field_name_lower or 'title' in field_name_lower:
        mfr_name = manufacturer.name if manufacturer else ''
        series_name = series.name if series else ''
        return f"{mfr_name} {series_name} {model.name} Cover"
    
    if 'brand' in field_name_lower or 'brand_name' in field_name_lower:
        return manufacturer.name if manufacturer else None
    
    if 'model' in field_name_lower or 'model_number' in field_name_lower or 'model_name' in field_name_lower:
        return model.name
    
    if 'manufacturer' in field_name_lower:
        return manufacturer.name if manufacturer else None
    
    return None
