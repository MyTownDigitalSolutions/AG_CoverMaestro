from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from app.database import get_db
from app.models.core import Supplier, SupplierMaterial
from app.schemas.core import (
    SupplierCreate, SupplierResponse,
    SupplierMaterialCreate, SupplierMaterialResponse
)

router = APIRouter(prefix="/suppliers", tags=["suppliers"])

@router.get("", response_model=List[SupplierResponse])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).all()

@router.get("/{id}", response_model=SupplierResponse)
def get_supplier(id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.post("", response_model=SupplierResponse)
def create_supplier(data: SupplierCreate, db: Session = Depends(get_db)):
    try:
        supplier = Supplier(name=data.name)
        db.add(supplier)
        db.commit()
        db.refresh(supplier)
        return supplier
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Supplier with this name already exists")

@router.put("/{id}", response_model=SupplierResponse)
def update_supplier(id: int, data: SupplierCreate, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    try:
        supplier.name = data.name
        db.commit()
        db.refresh(supplier)
        return supplier
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Supplier with this name already exists")

@router.delete("/{id}")
def delete_supplier(id: int, db: Session = Depends(get_db)):
    supplier = db.query(Supplier).filter(Supplier.id == id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(supplier)
    db.commit()
    return {"message": "Supplier deleted"}

@router.get("/{id}/materials", response_model=List[SupplierMaterialResponse])
def list_supplier_materials(id: int, db: Session = Depends(get_db)):
    return db.query(SupplierMaterial).filter(SupplierMaterial.supplier_id == id).all()

@router.post("/materials", response_model=SupplierMaterialResponse)
def create_supplier_material(data: SupplierMaterialCreate, db: Session = Depends(get_db)):
    supplier_material = SupplierMaterial(
        supplier_id=data.supplier_id,
        material_id=data.material_id,
        unit_cost=data.unit_cost
    )
    db.add(supplier_material)
    db.commit()
    db.refresh(supplier_material)
    return supplier_material
