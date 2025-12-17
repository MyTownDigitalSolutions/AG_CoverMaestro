from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.core import EquipmentType
from app.models.templates import AmazonProductType, ProductTypeField, EquipmentTypeProductType
from app.schemas.templates import (
    AmazonProductTypeResponse, ProductTypeFieldResponse, TemplateImportResponse,
    EquipmentTypeProductTypeLinkCreate, EquipmentTypeProductTypeLinkResponse
)
from app.services.template_service import TemplateService

router = APIRouter(prefix="/templates", tags=["templates"])

@router.post("/import", response_model=TemplateImportResponse)
async def import_template(
    file: UploadFile = File(...),
    product_code: str = Form(...),
    db: Session = Depends(get_db)
):
    service = TemplateService(db)
    result = await service.import_amazon_template(file, product_code)
    return result

@router.get("", response_model=List[AmazonProductTypeResponse])
def list_product_types(db: Session = Depends(get_db)):
    return db.query(AmazonProductType).all()

@router.post("/equipment-type-links", response_model=EquipmentTypeProductTypeLinkResponse)
def link_equipment_type_to_product_type(
    link: EquipmentTypeProductTypeLinkCreate,
    db: Session = Depends(get_db)
):
    equipment_type = db.query(EquipmentType).filter(EquipmentType.id == link.equipment_type_id).first()
    if not equipment_type:
        raise HTTPException(status_code=404, detail="Equipment type not found")
    
    product_type = db.query(AmazonProductType).filter(AmazonProductType.id == link.product_type_id).first()
    if not product_type:
        raise HTTPException(status_code=404, detail="Product type not found")
    
    existing = db.query(EquipmentTypeProductType).filter(
        EquipmentTypeProductType.equipment_type_id == link.equipment_type_id,
        EquipmentTypeProductType.product_type_id == link.product_type_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Link already exists")
    
    new_link = EquipmentTypeProductType(
        equipment_type_id=link.equipment_type_id,
        product_type_id=link.product_type_id
    )
    db.add(new_link)
    db.commit()
    db.refresh(new_link)
    return new_link

@router.get("/equipment-type-links", response_model=List[EquipmentTypeProductTypeLinkResponse])
def list_equipment_type_links(db: Session = Depends(get_db)):
    return db.query(EquipmentTypeProductType).all()

@router.get("/equipment-type/{equipment_type_id}/product-type", response_model=AmazonProductTypeResponse | None)
def get_product_type_for_equipment_type(equipment_type_id: int, db: Session = Depends(get_db)):
    link = db.query(EquipmentTypeProductType).filter(
        EquipmentTypeProductType.equipment_type_id == equipment_type_id
    ).first()
    if not link:
        return None
    return db.query(AmazonProductType).filter(AmazonProductType.id == link.product_type_id).first()

@router.delete("/equipment-type-links/{link_id}")
def delete_equipment_type_link(link_id: int, db: Session = Depends(get_db)):
    link = db.query(EquipmentTypeProductType).filter(EquipmentTypeProductType.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
    return {"message": "Link deleted"}

@router.get("/{product_code}", response_model=AmazonProductTypeResponse)
def get_product_type(product_code: str, db: Session = Depends(get_db)):
    product_type = db.query(AmazonProductType).filter(
        AmazonProductType.code == product_code
    ).first()
    if not product_type:
        raise HTTPException(status_code=404, detail="Product type not found")
    return product_type

@router.get("/{product_code}/fields", response_model=List[ProductTypeFieldResponse])
def get_product_type_fields(product_code: str, db: Session = Depends(get_db)):
    product_type = db.query(AmazonProductType).filter(
        AmazonProductType.code == product_code
    ).first()
    if not product_type:
        raise HTTPException(status_code=404, detail="Product type not found")
    return db.query(ProductTypeField).filter(
        ProductTypeField.product_type_id == product_type.id
    ).order_by(ProductTypeField.order_index).all()

@router.get("/{product_code}/header-rows")
def get_header_rows(product_code: str, db: Session = Depends(get_db)):
    product_type = db.query(AmazonProductType).filter(
        AmazonProductType.code == product_code
    ).first()
    if not product_type:
        raise HTTPException(status_code=404, detail="Product type not found")
    return {"header_rows": product_type.header_rows or []}

@router.delete("/{product_code}")
def delete_product_type(product_code: str, db: Session = Depends(get_db)):
    product_type = db.query(AmazonProductType).filter(
        AmazonProductType.code == product_code
    ).first()
    if not product_type:
        raise HTTPException(status_code=404, detail="Product type not found")
    db.delete(product_type)
    db.commit()
    return {"message": "Product type deleted"}
