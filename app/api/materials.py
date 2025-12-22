from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from app.database import get_db
from app.models.core import Material, MaterialColourSurcharge, SupplierMaterial, Supplier
from app.schemas.core import (
    MaterialCreate, MaterialResponse,
    MaterialColourSurchargeCreate, MaterialColourSurchargeResponse,
    SupplierMaterialWithSupplierResponse, SetPreferredSupplierRequest
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
            material_type=data.material_type,
            linear_yard_width=data.linear_yard_width,
            weight_per_linear_yard=data.weight_per_linear_yard,
            unit_of_measure=data.unit_of_measure,
            package_quantity=data.package_quantity
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
        material.material_type = data.material_type
        material.linear_yard_width = data.linear_yard_width
        material.weight_per_linear_yard = data.weight_per_linear_yard
        material.unit_of_measure = data.unit_of_measure
        material.package_quantity = data.package_quantity
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
    try:
        db.delete(material)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Cannot delete material because it is referenced by other records (e.g. orders)."
        )
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

@router.get("/{id}/suppliers", response_model=List[SupplierMaterialWithSupplierResponse])
def list_material_suppliers(id: int, db: Session = Depends(get_db)):
    """Get all suppliers who provide this material with their pricing."""
    material = db.query(Material).filter(Material.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    supplier_materials = db.query(SupplierMaterial).filter(
        SupplierMaterial.material_id == id
    ).all()
    
    result = []
    for sm in supplier_materials:
        supplier = db.query(Supplier).filter(Supplier.id == sm.supplier_id).first()
        qty = sm.quantity_purchased or 1.0
        shipping = sm.shipping_cost or 0.0
        unit = sm.unit_cost
        
        cost_per_linear_yard = unit + (shipping / qty) if qty > 0 else unit
        linear_yard_width = material.linear_yard_width or 54.0
        linear_yard_area = linear_yard_width * 36
        cost_per_square_inch = cost_per_linear_yard / linear_yard_area if linear_yard_area > 0 else 0
        
        result.append(SupplierMaterialWithSupplierResponse(
            id=sm.id,
            supplier_id=sm.supplier_id,
            material_id=sm.material_id,
            unit_cost=unit,
            shipping_cost=shipping,
            quantity_purchased=qty,
            is_preferred=sm.is_preferred or False,
            supplier_name=supplier.name if supplier else "Unknown",
            material_type=material.material_type,
            cost_per_linear_yard=round(cost_per_linear_yard, 4),
            cost_per_square_inch=round(cost_per_square_inch, 6)
        ))
    return result

@router.patch("/{id}/set-preferred-supplier")
def set_preferred_supplier(id: int, data: SetPreferredSupplierRequest, db: Session = Depends(get_db)):
    """Set a supplier as the preferred source for this material.
    Toggles all other suppliers for this material to is_preferred=False.
    """
    material = db.query(Material).filter(Material.id == id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    target_link = db.query(SupplierMaterial).filter(
        SupplierMaterial.material_id == id,
        SupplierMaterial.supplier_id == data.supplier_id
    ).first()
    
    if not target_link:
        raise HTTPException(
            status_code=404, 
            detail="This supplier is not linked to this material"
        )
    
    db.query(SupplierMaterial).filter(
        SupplierMaterial.material_id == id
    ).update({"is_preferred": False})
    
    target_link.is_preferred = True
    db.commit()
    
    return {"message": f"Supplier set as preferred for {material.name}"}

@router.get("/{id}/preferred-supplier")
def get_preferred_supplier(id: int, db: Session = Depends(get_db)):
    """Get the preferred supplier for this material."""
    preferred = db.query(SupplierMaterial).filter(
        SupplierMaterial.material_id == id,
        SupplierMaterial.is_preferred == True
    ).first()
    
    if not preferred:
        return {"preferred_supplier": None, "unit_cost": None, "shipping_cost": None}
    
    supplier = db.query(Supplier).filter(Supplier.id == preferred.supplier_id).first()
    return {
        "preferred_supplier": supplier.name if supplier else None,
        "supplier_id": preferred.supplier_id,
        "unit_cost": preferred.unit_cost,
        "shipping_cost": preferred.shipping_cost or 0.0
    }
