from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from app.database import get_db
from app.models.core import EquipmentType
from app.schemas.core import EquipmentTypeCreate, EquipmentTypeResponse

router = APIRouter(prefix="/equipment-types", tags=["equipment-types"])

@router.get("", response_model=List[EquipmentTypeResponse])
def list_equipment_types(db: Session = Depends(get_db)):
    return db.query(EquipmentType).all()

@router.get("/{id}", response_model=EquipmentTypeResponse)
def get_equipment_type(id: int, db: Session = Depends(get_db)):
    equipment_type = db.query(EquipmentType).filter(EquipmentType.id == id).first()
    if not equipment_type:
        raise HTTPException(status_code=404, detail="Equipment type not found")
    return equipment_type

@router.post("", response_model=EquipmentTypeResponse)
def create_equipment_type(data: EquipmentTypeCreate, db: Session = Depends(get_db)):
    try:
        equipment_type = EquipmentType(
            name=data.name,
            uses_handle_options=data.uses_handle_options,
            uses_angle_options=data.uses_angle_options
        )
        db.add(equipment_type)
        db.commit()
        db.refresh(equipment_type)
        return equipment_type
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Equipment type with this name already exists")

@router.put("/{id}", response_model=EquipmentTypeResponse)
def update_equipment_type(id: int, data: EquipmentTypeCreate, db: Session = Depends(get_db)):
    equipment_type = db.query(EquipmentType).filter(EquipmentType.id == id).first()
    if not equipment_type:
        raise HTTPException(status_code=404, detail="Equipment type not found")
    try:
        equipment_type.name = data.name
        equipment_type.uses_handle_options = data.uses_handle_options
        equipment_type.uses_angle_options = data.uses_angle_options
        db.commit()
        db.refresh(equipment_type)
        return equipment_type
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Equipment type with this name already exists")

@router.delete("/{id}")
def delete_equipment_type(id: int, db: Session = Depends(get_db)):
    equipment_type = db.query(EquipmentType).filter(EquipmentType.id == id).first()
    if not equipment_type:
        raise HTTPException(status_code=404, detail="Equipment type not found")
    db.delete(equipment_type)
    db.commit()
    return {"message": "Equipment type deleted"}
