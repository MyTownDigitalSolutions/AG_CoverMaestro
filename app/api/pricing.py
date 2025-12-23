from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from app.database import get_db
from app.models.core import PricingOption, ShippingRate, EquipmentType, EquipmentTypePricingOption
from app.schemas.core import (
    PricingOptionCreate, PricingOptionResponse,
    ShippingRateCreate, ShippingRateResponse,
    PricingOptionCreate, PricingOptionResponse,
    ShippingRateCreate, ShippingRateResponse,
    PricingCalculateRequest, PricingCalculateResponse,
    PricingRecalculateBulkRequest, PricingRecalculateBulkResponse, PricingRecalculateResult
)
from app.services.pricing_service import PricingService
from app.services.pricing_calculator import PricingCalculator
from app.models.core import Model, Series

router = APIRouter(prefix="/pricing", tags=["pricing"])

@router.post("/calculate", response_model=PricingCalculateResponse)
def calculate_pricing(data: PricingCalculateRequest, db: Session = Depends(get_db)):
    try:
        service = PricingService(db)
        result = service.calculate_total(
            model_id=data.model_id,
            material_id=data.material_id,
            colour=data.colour,
            quantity=data.quantity,
            handle_zipper=data.handle_zipper,
            two_in_one_pocket=data.two_in_one_pocket,
            music_rest_zipper=data.music_rest_zipper,
            carrier=data.carrier,
            zone=data.zone
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/options", response_model=List[PricingOptionResponse])
def list_pricing_options(db: Session = Depends(get_db)):
    return db.query(PricingOption).all()

@router.get("/options/{id}", response_model=PricingOptionResponse)
def get_pricing_option(id: int, db: Session = Depends(get_db)):
    option = db.query(PricingOption).filter(PricingOption.id == id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Pricing option not found")
    return option

@router.post("/options", response_model=PricingOptionResponse)
def create_pricing_option(data: PricingOptionCreate, db: Session = Depends(get_db)):
    try:
        option = PricingOption(name=data.name, price=data.price)
        db.add(option)
        db.commit()
        db.refresh(option)
        return option
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Pricing option with this name already exists")

@router.put("/options/{id}", response_model=PricingOptionResponse)
def update_pricing_option(id: int, data: PricingOptionCreate, db: Session = Depends(get_db)):
    option = db.query(PricingOption).filter(PricingOption.id == id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Pricing option not found")
    try:
        option.name = data.name
        option.price = data.price
        db.commit()
        db.refresh(option)
        return option
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Pricing option with this name already exists")

@router.delete("/options/{id}")
def delete_pricing_option(id: int, db: Session = Depends(get_db)):
    option = db.query(PricingOption).filter(PricingOption.id == id).first()
    if not option:
        raise HTTPException(status_code=404, detail="Pricing option not found")
    db.delete(option)
    db.commit()
    return {"message": "Pricing option deleted"}

@router.get("/options/by-equipment-type/{equipment_type_id}", response_model=List[PricingOptionResponse])
def get_options_for_equipment_type(equipment_type_id: int, db: Session = Depends(get_db)):
    """Get all pricing options assigned to a specific equipment type."""
    equipment_type = db.query(EquipmentType).filter(EquipmentType.id == equipment_type_id).first()
    if not equipment_type:
        raise HTTPException(status_code=404, detail="Equipment type not found")
    
    option_ids = db.query(EquipmentTypePricingOption.pricing_option_id).filter(
        EquipmentTypePricingOption.equipment_type_id == equipment_type_id
    ).all()
    option_ids = [o[0] for o in option_ids]
    
    if not option_ids:
        return []
    
    return db.query(PricingOption).filter(PricingOption.id.in_(option_ids)).all()

@router.get("/shipping-rates", response_model=List[ShippingRateResponse])
def list_shipping_rates(db: Session = Depends(get_db)):
    return db.query(ShippingRate).all()

@router.post("/shipping-rates", response_model=ShippingRateResponse)
def create_shipping_rate(data: ShippingRateCreate, db: Session = Depends(get_db)):
    rate = ShippingRate(
        carrier=data.carrier,
        min_weight=data.min_weight,
        max_weight=data.max_weight,
        zone=data.zone,
        rate=data.rate,
        surcharge=data.surcharge
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate

@router.post("/recalculate/bulk", response_model=PricingRecalculateBulkResponse)
def recalculate_bulk(data: PricingRecalculateBulkRequest, db: Session = Depends(get_db)):
    """
    Recalculate pricing for a scoped set of models.
    Scope: manufacturer | series | models
    Marketplaces: currently defaults to ["amazon"]
    Variant Set: currently only "baseline4" supported (implied/strict)
    """
    
    # 1. Resolve Models
    models_to_process = []
    
    if data.scope == "models":
        if not data.model_ids:
            # If empty list, do nothing? Or error? Let's assume empty list is valid but results in 0
            if data.model_ids is None:
                 raise HTTPException(status_code=400, detail="model_ids required for 'models' scope")
        
        models_to_process = db.query(Model).filter(Model.id.in_(data.model_ids)).all()

    elif data.scope == "series":
        if not data.manufacturer_id or not data.series_id:
            raise HTTPException(status_code=400, detail="manufacturer_id and series_id required for 'series' scope")
        
        # Verify valid series
        series = db.query(Series).filter(
            Series.id == data.series_id, 
            Series.manufacturer_id == data.manufacturer_id
        ).first()
        if not series:
             raise HTTPException(status_code=404, detail="Series not found or does not belong to Manufacturer")
             
        models_to_process = db.query(Model).filter(Model.series_id == data.series_id).all()

    elif data.scope == "manufacturer":
        if not data.manufacturer_id:
             raise HTTPException(status_code=400, detail="manufacturer_id required for 'manufacturer' scope")
        
        # Determine all series for manufacturer, then all models
        # Or join
        models_to_process = db.query(Model).join(Series).filter(
            Series.manufacturer_id == data.manufacturer_id
        ).all()
        
    else:
        raise HTTPException(status_code=400, detail=f"Invalid scope: {data.scope}")

    # 2. Results Container
    results_map = {}
    
    marketplaces = data.marketplaces if data.marketplaces else ["amazon"]
    
    for mp in marketplaces:
        results_map[mp] = {
            "succeeded": [],
            "failed": []
        }
        
    # 3. Processing Loop
    processed_count = 0
    
    if data.dry_run:
        # Just return count
        return PricingRecalculateBulkResponse(
            marketplaces=marketplaces,
            scope=data.scope,
            resolved_model_count=len(models_to_process),
            results=results_map
        )
        
    for model in models_to_process:
        processed_count += 1
        for mp in marketplaces:
            try:
                # Use PricingCalculator
                # This commits internally? No, check models.py: db.commit() is OUTSIDE calculator.
                # models.py: PricingCalculator(db).calculate_model_prices(...) -> db.commit()
                # calculator.py has self.db.flush() but NO commit.
                
                # We should catch per model, rollback per model if needed?
                # But we share a session 'db'. If we rollback, we lose everything?
                # Standard pattern: nested transaction or savepoint?
                # SQLAlchemy: db.begin_nested()
                
                with db.begin_nested():
                     PricingCalculator(db).calculate_model_prices(model.id, marketplace=mp)
                
                results_map[mp]["succeeded"].append(model.id)
                
            except Exception as e:
                # Capture error
                results_map[mp]["failed"].append(
                    PricingRecalculateResult(model_id=model.id, error=str(e))
                )
    
    # Final Commit (persists successful nested transactions)
    # Failed nested transactions were rolled back when context exited with exception?
    # Wait, begin_nested() rollback logic depends on usage.
    # If using context manager, it rollbacks on exception automatically.
    
    try:
        db.commit()
    except Exception as e:
        # If commit fails (rare here due to flush?), fail specific items? 
        # Hard to map back.
        # But if we used nested, we should be okay.
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Global commit failed: {str(e)}")

    return PricingRecalculateBulkResponse(
        marketplaces=marketplaces,
        scope=data.scope,
        resolved_model_count=len(models_to_process),
        results=results_map
    )
