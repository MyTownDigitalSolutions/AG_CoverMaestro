from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from app.database import get_db
from app.models.core import Material, MaterialColourSurcharge
from app.schemas.core import (
    MaterialCreate, MaterialResponse,
    MaterialColourSurchargeCreate, MaterialColourSurchargeResponse
)

router = APIRouter(prefix="/materials", tags=["materials"])

@router.get("", response_model=List[MaterialResponse])
def list_materials(db: Session = Depends(get_db)):
    return db.query(Material).all()

@router.get("/{id}", response_model=MaterialResponse)
def get_material(id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return material

@router.post("", response_model=MaterialResponse)
def create_material(data: MaterialCreate, db: Session = Depends(get_db)):
    try:
        material = Material(
            name=data.name,
            base_color=data.base_color,
            linear_yard_width=data.linear_yard_width,
            cost_per_linear_yard=data.cost_per_linear_yard,
            weight_per_linear_yard=data.weight_per_linear_yard,
            labor_time_minutes=data.labor_time_minutes
        )
        db.add(material)
        db.commit()
        db.refresh(material)
        return material
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Material with this name already exists")

@router.put("/{id}", response_model=MaterialResponse)
def update_material(id: int, data: MaterialCreate, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    try:
        material.name = data.name
        material.base_color = data.base_color
        material.linear_yard_width = data.linear_yard_width
        material.cost_per_linear_yard = data.cost_per_linear_yard
        material.weight_per_linear_yard = data.weight_per_linear_yard
        material.labor_time_minutes = data.labor_time_minutes
        db.commit()
        db.refresh(material)
        return material
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Material with this name already exists")

@router.delete("/{id}")
def delete_material(id: int, db: Session = Depends(get_db)):
    material = db.query(Material).filter(Material.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(material)
    db.commit()
    return {"message": "Material deleted"}

@router.get("/{id}/surcharges", response_model=List[MaterialColourSurchargeResponse])
def list_material_surcharges(id: int, db: Session = Depends(get_db)):
    return db.query(MaterialColourSurcharge).filter(MaterialColourSurcharge.material_id == id).all()

@router.post("/surcharges", response_model=MaterialColourSurchargeResponse)
def create_surcharge(data: MaterialColourSurchargeCreate, db: Session = Depends(get_db)):
    surcharge = MaterialColourSurcharge(
        material_id=data.material_id,
        colour=data.colour,
        surcharge=data.surcharge
    )
    db.add(surcharge)
    db.commit()
    db.refresh(surcharge)
    return surcharge
