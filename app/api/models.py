from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from app.database import get_db
from app.models.core import Model, Series, Manufacturer, ModelPricingSnapshot, ModelPricingHistory, DesignOption
from app.schemas.core import ModelCreate, ModelResponse, ModelPricingSnapshotResponse, ModelPricingHistoryResponse
from app.schemas.pricing_diff import PricingDiffResponse

from app.services.pricing_calculator import PricingCalculator
from app.services.pricing_diff_service import PricingDiffService

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

def validate_design_option(option_id: Optional[int], expected_type: str, db: Session) -> None:
    """Validate that a design option exists and has the correct type."""
    if option_id is not None:
        option = db.query(DesignOption).filter(DesignOption.id == option_id).first()
        if not option:
            raise HTTPException(
                status_code=400,
                detail=f"Design option with id {option_id} not found"
            )
        if option.option_type != expected_type:
            raise HTTPException(
                status_code=400,
                detail=f"Design option {option_id} has type '{option.option_type}', expected '{expected_type}'"
            )

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
        
        # Validate design option selections
        validate_design_option(data.handle_location_option_id, "handle_location", db)
        validate_design_option(data.angle_type_option_id, "angle_type", db)
        
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
            surface_area_sq_in=surface_area,
            top_depth_in=data.top_depth_in,
            angle_drop_in=data.angle_drop_in,
            handle_location_option_id=data.handle_location_option_id,
            angle_type_option_id=data.angle_type_option_id,
            top_handle_length_in=data.top_handle_length_in,
            top_handle_height_in=data.top_handle_height_in,
            top_handle_rear_edge_to_center_in=data.top_handle_rear_edge_to_center_in
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
        
        # Validate design option selections
        validate_design_option(data.handle_location_option_id, "handle_location", db)
        validate_design_option(data.angle_type_option_id, "angle_type", db)
        
        # Regenerate parent SKU if name, series, or manufacturer changed
        parent_sku = generate_parent_sku(manufacturer.name, series.name, data.name)
        
        # Recalculate surface area
        surface_area = calculate_surface_area(data.width, data.depth, data.height)
        
        # Temporary logging for verification
        print(f"[models.py] Updating Model ID: {id}")
        print(f"[models.py] Update payload fields: {list(data.dict().keys())}")
        print(f"[models.py] Received enum values - handle_location: {data.handle_location}, angle_type: {data.angle_type}")
        print(f"[models.py] Received FK IDs - handle_location_option_id: {data.handle_location_option_id}, angle_type_option_id: {data.angle_type_option_id}")
        
        model.name = data.name
        model.series_id = data.series_id
        model.equipment_type_id = data.equipment_type_id
        model.width = data.width
        model.depth = data.depth
        model.height = data.height
        model.handle_length = data.handle_length
        model.handle_width = data.handle_width
        # Always assign enums explicitly - they have defaults so never None from schema
        model.handle_location = data.handle_location
        model.angle_type = data.angle_type
        model.image_url = data.image_url
        model.parent_sku = parent_sku
        model.surface_area_sq_in = surface_area
        model.top_depth_in = data.top_depth_in
        model.angle_drop_in = data.angle_drop_in
        
        # Assign FK-based design option selections
        if data.handle_location_option_id is not None:
            model.handle_location_option_id = data.handle_location_option_id
        if data.angle_type_option_id is not None:
            model.angle_type_option_id = data.angle_type_option_id
        
        # Assign top handle measurements (check presence to allow clearing to None)
        # Using model_fields_set (Pydantic v2) or __fields_set__ (v1)
        fields_set = getattr(data, 'model_fields_set', getattr(data, '__fields_set__', set()))
        
        print(f"[models.py] Top Handle Update - Provided fields: {fields_set}")
        print(f"[models.py] Top Handle Update - Values: length={data.top_handle_length_in}, height={data.top_handle_height_in}, rear={data.top_handle_rear_edge_to_center_in}")

        if 'top_handle_length_in' in fields_set:
            model.top_handle_length_in = data.top_handle_length_in
        if 'top_handle_height_in' in fields_set:
            model.top_handle_height_in = data.top_handle_height_in
        if 'top_handle_rear_edge_to_center_in' in fields_set:
            model.top_handle_rear_edge_to_center_in = data.top_handle_rear_edge_to_center_in
        
        db.flush() # Flush changes for pricing

        # Auto-recalculate pricing (Atomic Transaction)
        try:
            PricingCalculator(db).calculate_model_prices(model.id, marketplace="DEFAULT")
            db.commit()
            db.refresh(model)
            
            # Log what was actually saved
            print(f"[models.py] After save - handle_location: {model.handle_location}, angle_type: {model.angle_type}")
            print(f"[models.py] After save - handle_location_option_id: {model.handle_location_option_id}, angle_type_option_id: {model.angle_type_option_id}")
            print(f"[models.py] After save - top_handle measurements: length={model.top_handle_length_in}, height={model.top_handle_height_in}, rear_edge={model.top_handle_rear_edge_to_center_in}")
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

@router.get("/{id}/pricing/snapshots", response_model=List[ModelPricingSnapshotResponse])
def get_model_baseline_snapshots(
    id: int, 
    marketplace: str = Query("amazon"), 
    db: Session = Depends(get_db)
):
    """
    Get the 4 baseline pricing snapshots (Choice/Premium x Padded/NoPadding).
    Sorted in stable order: Choice NoPad, Choice Pad, Premium NoPad, Premium Pad.
    """
    BASELINE_KEYS = [
        "choice_no_padding", 
        "choice_padded", 
        "premium_no_padding", 
        "premium_padded"
    ]
    
    rows = db.query(ModelPricingSnapshot).filter(
        ModelPricingSnapshot.model_id == id,
        ModelPricingSnapshot.marketplace == marketplace,
        ModelPricingSnapshot.variant_key.in_(BASELINE_KEYS)
    ).all()
    
    # Sort in Python to ensure stable order
    sort_map = {key: i for i, key in enumerate(BASELINE_KEYS)}
    sorted_rows = sorted(rows, key=lambda x: sort_map.get(x.variant_key, 999))
    
    return sorted_rows

@router.post("/{id}/pricing/recalculate", response_model=List[ModelPricingSnapshotResponse])
def recalculate_model_pricing(id: int, marketplace: str = Query("amazon"), db: Session = Depends(get_db)):
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

@router.get("/{id}/pricing/history", response_model=List[ModelPricingHistoryResponse])
def get_model_pricing_history(
    id: int, 
    marketplace: Optional[str] = None, 
    variant_key: Optional[str] = None,
    limit: int = 200, 
    db: Session = Depends(get_db)
):
    """Get pricing history for a model."""
    query = db.query(ModelPricingHistory).filter(ModelPricingHistory.model_id == id)
    
    if marketplace:
        query = query.filter(ModelPricingHistory.marketplace == marketplace)
    
    if variant_key:
        query = query.filter(ModelPricingHistory.variant_key == variant_key)
        
    return query.order_by(ModelPricingHistory.calculated_at.desc()).limit(limit).all()

@router.get("/{id}/pricing/diff", response_model=Optional[PricingDiffResponse])
def get_model_pricing_diff(
    id: int,
    variant_key: str,
    marketplace: str = "DEFAULT",
    db: Session = Depends(get_db)
):
    """
    Get the difference between the two most recent pricing history entries.
    Returns null if insufficient history exists (fewer than 2 rows).
    """
    return PricingDiffService(db).diff_latest(id, marketplace, variant_key)

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
