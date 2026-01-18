from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from app.database import get_db
from app.models.core import DesignOption, EquipmentTypeDesignOption
from app.schemas.core import DesignOptionCreate, DesignOptionResponse

router = APIRouter(prefix="/design-options", tags=["design-options"])

@router.get("", response_model=List[DesignOptionResponse])
def list_design_options(db: Session = Depends(get_db)):
    return db.query(DesignOption).all()

@router.get("/{id}", response_model=DesignOptionResponse)
def get_design_option(id: int, db: Session = Depends(get_db)):
    option = db.query(DesignOption).filter(DesignOption.id == id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Design option not found")
    return option

@router.post("", response_model=DesignOptionResponse)
def create_design_option(data: DesignOptionCreate, db: Session = Depends(get_db)):
    try:
        option = DesignOption(
            name=data.name, 
            description=data.description, 
            option_type=data.option_type,
            is_pricing_relevant=data.is_pricing_relevant,
            sku_abbreviation=data.sku_abbreviation,
            ebay_variation_enabled=data.ebay_variation_enabled
        )
        db.add(option)
        db.flush()
        
        for et_id in data.equipment_type_ids:
            assoc = EquipmentTypeDesignOption(design_option_id=option.id, equipment_type_id=et_id)
            db.add(assoc)
            
        db.commit()
        db.refresh(option)
        return option
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Design option with this name already exists")

@router.put("/{id}", response_model=DesignOptionResponse)
def update_design_option(id: int, data: DesignOptionCreate, db: Session = Depends(get_db)):
    option = db.query(DesignOption).filter(DesignOption.id == id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Design option not found")
    try:
        option.name = data.name
        option.description = data.description
        option.option_type = data.option_type
        option.is_pricing_relevant = data.is_pricing_relevant
        option.sku_abbreviation = data.sku_abbreviation
        option.ebay_variation_enabled = data.ebay_variation_enabled
        
        # Update associations
        db.query(EquipmentTypeDesignOption).filter(EquipmentTypeDesignOption.design_option_id == id).delete()
        for et_id in data.equipment_type_ids:
            assoc = EquipmentTypeDesignOption(design_option_id=id, equipment_type_id=et_id)
            db.add(assoc)

        db.commit()
        db.refresh(option)
        return option
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Design option with this name already exists")

@router.delete("/{id}")
def delete_design_option(id: int, db: Session = Depends(get_db)):
    option = db.query(DesignOption).filter(DesignOption.id == id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Design option not found")
    db.query(EquipmentTypeDesignOption).filter(
        EquipmentTypeDesignOption.design_option_id == id
    ).delete()
    db.delete(option)
    db.commit()
    return {"message": "Design option deleted"}
