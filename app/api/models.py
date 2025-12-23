from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from app.database import get_db
from app.models.core import Model, Series, Manufacturer
from app.schemas.core import ModelCreate, ModelResponse, ModelPricingSnapshotResponse

from app.services.pricing_calculator import PricingCalculator
from app.models.core import ModelPricingSnapshot

router = APIRouter(prefix="/models", tags=["models"])

WASTE_FACTOR = 0.05

def calculate_surface_area(width: float, depth: float, height: float) -> float:
    """
    Calculate surface area in square inches including waste factor.
    Formula: 2 * (width*depth + width*height + depth*height) * (1 + WASTE_FACTOR)
    """
    base_area = 2 * (width * depth + width * height + depth * height)
    return base_area * (1 + WASTE_FACTOR)

def generate_parent_sku(manufacturer_name: str, series_name: str, model_name: str, version: str = "V1") -> str:
    """
    Generate a 40-character parent SKU.
    Format: MFGR(8)-SERIES(8)-MODEL(13)V1 + zeros
    Multi-word names are concatenated and camelCased.
    """
    def process_name(name: str, max_len: int, pad_char: str = "X") -> str:
        # Split by spaces and camelCase each word
        words = name.split()
        if len(words) > 1:
            # CamelCase: capitalize first letter of each word
            result = "".join(word.capitalize() for word in words)
        else:
            result = name.capitalize()
        
        # Remove any non-alphanumeric characters
        result = "".join(c for c in result if c.isalnum())
        
        # Truncate to max length
        result = result[:max_len].upper()
        
        # Pad with pad_char if shorter than max_len
        result = result.ljust(max_len, pad_char)
        
        return result
    
    # Process each part
    mfgr_part = process_name(manufacturer_name, 8)  # 8 chars
    series_part = process_name(series_name, 8)      # 8 chars
    model_part = process_name(model_name, 13)       # 13 chars
    
    # Ensure version is 2 chars
    version_part = version[:2].upper()
    
    # Build SKU: MFGR-SERIES-MODEL+VERSION (8+1+8+1+13+2 = 33)
    sku = f"{mfgr_part}-{series_part}-{model_part}{version_part}"
    
    # Pad with zeros to reach 40 characters
    sku = sku.ljust(40, "0")
    
    return sku

@router.get("", response_model=List[ModelResponse])
def list_models(series_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    query = db.query(Model)
    if series_id:
        query = query.filter(Model.series_id == series_id)
    return query.all()

@router.get("/{id}", response_model=ModelResponse)
def get_model(id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model

@router.post("", response_model=ModelResponse)
def create_model(data: ModelCreate, db: Session = Depends(get_db)):
    try:
        # Get series and manufacturer names for SKU generation
        series = db.query(Series).filter(Series.id == data.series_id).first()
        if not series:
            raise HTTPException(status_code=400, detail="Series not found")
        manufacturer = db.query(Manufacturer).filter(Manufacturer.id == series.manufacturer_id).first()
        if not manufacturer:
            raise HTTPException(status_code=400, detail="Manufacturer not found")
        
        # Generate parent SKU
        parent_sku = generate_parent_sku(manufacturer.name, series.name, data.name)
        
        # Calculate surface area
        surface_area = calculate_surface_area(data.width, data.depth, data.height)
        
        model = Model(
            name=data.name,
            series_id=data.series_id,
            equipment_type_id=data.equipment_type_id,
            width=data.width,
            depth=data.depth,
            height=data.height,
            handle_length=data.handle_length,
            handle_width=data.handle_width,
            handle_location=data.handle_location,
            angle_type=data.angle_type,
            image_url=data.image_url,
            parent_sku=parent_sku,
            surface_area_sq_in=surface_area
        )
        db.add(model)
        db.flush() # Get ID for pricing

        # Auto-recalculate pricing (Atomic Transaction)
        try:
            PricingCalculator(db).calculate_model_prices(model.id, marketplace="DEFAULT")
            db.commit() # Commit both model and pricing
            db.refresh(model)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Pricing Calculation Failed: {str(e)}")

        return model
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Database Integrity Error: {str(e)}")

@router.put("/{id}", response_model=ModelResponse)
def update_model(id: int, data: ModelCreate, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    try:
        # Get series and manufacturer names for SKU regeneration
        series = db.query(Series).filter(Series.id == data.series_id).first()
        if not series:
            raise HTTPException(status_code=400, detail="Series not found")
        manufacturer = db.query(Manufacturer).filter(Manufacturer.id == series.manufacturer_id).first()
        if not manufacturer:
            raise HTTPException(status_code=400, detail="Manufacturer not found")
        
        # Regenerate parent SKU if name, series, or manufacturer changed
        parent_sku = generate_parent_sku(manufacturer.name, series.name, data.name)
        
        # Recalculate surface area
        surface_area = calculate_surface_area(data.width, data.depth, data.height)
        
        model.name = data.name
        model.series_id = data.series_id
        model.equipment_type_id = data.equipment_type_id
        model.width = data.width
        model.depth = data.depth
        model.height = data.height
        model.handle_length = data.handle_length
        model.handle_width = data.handle_width
        model.handle_location = data.handle_location
        model.angle_type = data.angle_type
        model.image_url = data.image_url
        model.parent_sku = parent_sku
        model.surface_area_sq_in = surface_area
        
        db.flush() # Flush changes for pricing

        # Auto-recalculate pricing (Atomic Transaction)
        try:
            PricingCalculator(db).calculate_model_prices(model.id, marketplace="DEFAULT")
            db.commit()
            db.refresh(model)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=400, detail=f"Pricing Calculation Failed: {str(e)}")

        return model
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Model with this name already exists in this series")

@router.get("/{id}/pricing", response_model=List[ModelPricingSnapshotResponse])
def get_model_pricing(id: int, marketplace: str = "DEFAULT", db: Session = Depends(get_db)):
    """Get pricing snapshots for a model."""
    snapshots = db.query(ModelPricingSnapshot).filter(
        ModelPricingSnapshot.model_id == id,
        ModelPricingSnapshot.marketplace == marketplace
    ).all()
@router.post("/{id}/pricing/recalculate", response_model=List[ModelPricingSnapshotResponse])
def recalculate_model_pricing(id: int, marketplace: str = "DEFAULT", db: Session = Depends(get_db)):
    """Manually trigger pricing recalculation for a model."""
    try:
        PricingCalculator(db).calculate_model_prices(id, marketplace=marketplace)
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Return updated snapshots
    return db.query(ModelPricingSnapshot).filter(
        ModelPricingSnapshot.model_id == id,
        ModelPricingSnapshot.marketplace == marketplace
    ).all()

@router.post("/pricing/recalculate-all")
def recalculate_all_models(marketplace: str = "DEFAULT", db: Session = Depends(get_db)):
    """Admin endpoint to recalculate pricing for ALL models."""
    models = db.query(Model).all()
    success_count = 0
    errors = []
    
    for model in models:
        try:
            PricingCalculator(db).calculate_model_prices(model.id, marketplace=marketplace)
            success_count += 1
        except Exception as e:
             errors.append(f"Model {model.id}: {str(e)}")
    
    db.commit() # Commit all successful ones
    
    return {
        "message": f"Recalculated {success_count}/{len(models)} models",
        "errors": errors
    }

@router.delete("/{id}")
def delete_model(id: int, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    db.delete(model)
    db.commit()
    return {"message": "Model deleted"}

@router.post("/regenerate-skus")
def regenerate_all_skus(db: Session = Depends(get_db)):
    """Regenerate parent SKUs for all models that don't have one."""
    models = db.query(Model).all()
    updated_count = 0
    
    for model in models:
        series = db.query(Series).filter(Series.id == model.series_id).first()
        if not series:
            continue
        manufacturer = db.query(Manufacturer).filter(Manufacturer.id == series.manufacturer_id).first()
        if not manufacturer:
            continue
        
        parent_sku = generate_parent_sku(manufacturer.name, series.name, model.name)
        if model.parent_sku != parent_sku:
            model.parent_sku = parent_sku
            updated_count += 1
    
    db.commit()
    return {"message": f"Regenerated SKUs for {updated_count} models"}
