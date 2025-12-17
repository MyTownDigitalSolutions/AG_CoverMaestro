from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.templates import AmazonProductType, ProductTypeField
from app.schemas.templates import AmazonProductTypeResponse, ProductTypeFieldResponse, TemplateImportResponse
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
