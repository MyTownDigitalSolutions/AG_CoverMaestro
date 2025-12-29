from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime
import traceback
from app.database import get_db
from app.models.core import Model, Series, Manufacturer, ModelPricingSnapshot, ModelPricingHistory, DesignOption, MarketplaceListing
from app.schemas.core import ModelCreate, ModelResponse, ModelPricingSnapshotResponse, ModelPricingHistoryResponse, MarketplaceListingCreate
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

def sync_marketplace_listings(model_id: int, listings_data: List[MarketplaceListingCreate], db: Session) -> None:
    """
    Sync marketplace listings for a model.
    - Match by (model_id, marketplace)
    - Update if exists
    - Create if not exists
    - Do NOT delete if not provided
    """
    for listing_data in listings_data:
        # Skip empty external_id
        if not listing_data.external_id or listing_data.external_id.strip() == "":
            continue
            
        # Look for existing listing by model_id and marketplace
        existing = db.query(MarketplaceListing).filter(
            MarketplaceListing.model_id == model_id,
            MarketplaceListing.marketplace == listing_data.marketplace
        ).first()
        
        if existing:
            # Update existing
            existing.external_id = listing_data.external_id
            existing.listing_url = listing_data.listing_url
            existing.updated_at = datetime.utcnow()
        else:
            # Create new
            new_listing = MarketplaceListing(
                model_id=model_id,
                marketplace=listing_data.marketplace,
                external_id=listing_data.external_id,
                listing_url=listing_data.listing_url
            )
            db.add(new_listing)

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
        print("=" * 80)
        print("🔥 CREATE_MODEL START 🔥")
        print(f"[DEBUG] Received data: {data.dict()}")
        
        print("[DEBUG] Step 1: Validate minimum requirements")
        # Validate minimum save requirements
        validation_errors = []
        if not data.series_id:
            validation_errors.append("Series is required")
        if not data.name or not data.name.strip():
            validation_errors.append("Model name is required")
        if not data.equipment_type_id:
            validation_errors.append("Equipment type is required")
        
        if validation_errors:
            print(f"[DEBUG] Validation failed: {validation_errors}")
            raise HTTPException(
                status_code=400, 
                detail={"message": "Validation failed", "errors": validation_errors}
            )
        print("[DEBUG] Step 1: PASSED ✓")
        
        print("[DEBUG] Step 2: Fetch series & manufacturer")
        # Get series and manufacturer names for SKU generation
        series = db.query(Series).filter(Series.id == data.series_id).first()
        if not series:
            print(f"[DEBUG] Series not found: {data.series_id}")
            raise HTTPException(status_code=400, detail="Series not found")
        print(f"[DEBUG] Found series: {series.name}")
        
        manufacturer = db.query(Manufacturer).filter(Manufacturer.id == series.manufacturer_id).first()
        if not manufacturer:
            print(f"[DEBUG] Manufacturer not found: {series.manufacturer_id}")
            raise HTTPException(status_code=400, detail="Manufacturer not found")
        print(f"[DEBUG] Found manufacturer: {manufacturer.name}")
        print("[DEBUG] Step 2: PASSED ✓")
        
        print("[DEBUG] Step 3: Validate design options")
        # Validate design option selections
        validate_design_option(data.handle_location_option_id, "handle_location", db)
        validate_design_option(data.angle_type_option_id, "angle_type", db)
        print("[DEBUG] Step 3: PASSED ✓")
        
        print("[DEBUG] Step 4: Generate SKU")
        # Generate parent SKU
        parent_sku = generate_parent_sku(manufacturer.name, series.name, data.name)
        print(f"[DEBUG] Generated SKU: {parent_sku}")
        print("[DEBUG] Step 4: PASSED ✓")
        
        print("[DEBUG] Step 5: Calculate surface area")
        # Calculate surface area
        surface_area = calculate_surface_area(data.width, data.depth, data.height)
        print(f"[DEBUG] Surface area: {surface_area}")
        print("[DEBUG] Step 5: PASSED ✓")
        
        print("[DEBUG] Step 6: Create Model object")
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
            sku_override=data.sku_override,
            surface_area_sq_in=surface_area,
            top_depth_in=data.top_depth_in,
            angle_drop_in=data.angle_drop_in,
            handle_location_option_id=data.handle_location_option_id,
            angle_type_option_id=data.angle_type_option_id,
            top_handle_length_in=data.top_handle_length_in,
            top_handle_height_in=data.top_handle_height_in,
            top_handle_rear_edge_to_center_in=data.top_handle_rear_edge_to_center_in
        )
        print(f"[DEBUG] Model object created: {model.name}")
        print("[DEBUG] Step 6: PASSED ✓")
        
        print("[DEBUG] Step 7: db.add(model)")
        db.add(model)
        print("[DEBUG] Step 7: PASSED ✓")
        
        print("[DEBUG] Step 8: db.flush()")
        db.flush() # Get ID for pricing
        print(f"[DEBUG] Model flushed with ID: {model.id}")
        print("[DEBUG] Step 8: PASSED ✓")
        
        print("[DEBUG] Step 9: Sync marketplace listings")
        # Sync marketplace listings if provided
        if data.marketplace_listings:
            print(f"[DEBUG] Syncing {len(data.marketplace_listings)} marketplace listings")
            sync_marketplace_listings(model.id, data.marketplace_listings, db)
            print("[DEBUG] Marketplace listings synced")
        else:
            print("[DEBUG] No marketplace listings to sync")
        print("[DEBUG] Step 9: PASSED ✓")

        print("[DEBUG] Step 10: Calculate pricing (optional)")
        # Check if we have sufficient data for pricing calculation
        has_dimensions = (
            data.width and data.width > 0 and
            data.depth and data.depth > 0 and
            data.height and data.height > 0
        )
        has_surface_area = surface_area and surface_area > 0
        
        if has_dimensions and has_surface_area:
            # Auto-recalculate pricing (Optional - only if dimensions exist)
            try:
                print(f"[DEBUG] Calculating pricing for model ID: {model.id}")
                # Use 'amazon' marketplace to match what "Recalculate Baseline (Amazon)" button uses
                PricingCalculator(db).calculate_model_prices(model.id, marketplace="amazon")
                print("[DEBUG] Pricing calculated successfully")
            except Exception as e:
                # Log but DO NOT block model creation
                print(f"[PRICING] Warning: Pricing calculation failed: {str(e)}")
                print(f"[PRICING] Model will be saved without pricing. Pricing can be calculated later.")
                traceback.print_exc()
                # DO NOT raise HTTPException - allow model to save
        else:
            print(f"[PRICING] Skipped – insufficient dimensions (w={data.width}, d={data.depth}, h={data.height}, sa={surface_area})")
            print(f"[PRICING] Model will be saved as draft. Pricing can be calculated later when dimensions are added.")
        
        print("[DEBUG] Step 10: PASSED ✓")
        
        print("[DEBUG] Step 11: db.commit()")
        db.commit() # Commit model (with or without pricing)
        print("[DEBUG] Step 11: PASSED ✓")
        
        print("[DEBUG] Step 12: db.refresh(model)")
        db.refresh(model)
        print(f"[DEBUG] Model refreshed. ID: {model.id}, SKU: {model.parent_sku}")
        print("[DEBUG] Step 12: PASSED ✓")
        
        print("[DEBUG] Step 13: Return model")
        print(f"[DEBUG] Returning model: ID={model.id}, name={model.name}, parent_sku={model.parent_sku}")
        print("🔥 CREATE_MODEL SUCCESS 🔥")
        print("=" * 80)
        return model
        
    except HTTPException:
        print("[DEBUG] HTTPException raised (re-raising)")
        raise
    except IntegrityError as e:
        print(f"🔥 DATABASE INTEGRITY ERROR 🔥")
        print(f"Error: {str(e)}")
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Database Integrity Error: {str(e)}")
    except Exception as e:
        print("🔥 CREATE_MODEL FAILED 🔥")
        print(f"Exception type: {type(e)}")
        print(f"Exception message: {str(e)}")
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{id}", response_model=ModelResponse)
def update_model(id: int, data: ModelCreate, db: Session = Depends(get_db)):
    model = db.query(Model).filter(Model.id == id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    try:
        # Validate minimum save requirements
        validation_errors = []
        if not data.series_id:
            validation_errors.append("Series is required")
        if not data.name or not data.name.strip():
            validation_errors.append("Model name is required")
        if not data.equipment_type_id:
            validation_errors.append("Equipment type is required")
        
        if validation_errors:
            raise HTTPException(
                status_code=400, 
                detail={"message": "Validation failed", "errors": validation_errors}
            )
        
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
        
        # Update sku_override if provided in fields_set
        fields_set = getattr(data, 'model_fields_set', getattr(data, '__fields_set__', set()))
        if 'sku_override' in fields_set:
            model.sku_override = data.sku_override
        
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
        
        # Update model_notes if provided
        fields_set = getattr(data, 'model_fields_set', getattr(data, '__fields_set__', set()))
        if 'model_notes' in fields_set:
            model.model_notes = data.model_notes
        
        # Sync marketplace listings if provided
        if data.marketplace_listings is not None:
            sync_marketplace_listings(model.id, data.marketplace_listings, db)
        
        print("[MODEL] Committing model changes...")
        # CRITICAL: Commit model changes BEFORE pricing logic
        db.commit()
        db.refresh(model)
        print(f"[MODEL] Update committed. ID: {model.id}, SKU: {model.parent_sku}")
        
        # Log what was actually saved
        print(f"[MODEL] Saved - dimensions: w={model.width}, d={model.depth}, h={model.height}")
        print(f"[MODEL] Saved - handle_location: {model.handle_location}, angle_type: {model.angle_type}")
        print(f"[MODEL] Saved - handle_location_option_id: {model.handle_location_option_id}, angle_type_option_id: {model.angle_type_option_id}")
        print(f"[MODEL] Saved - top_handle measurements: length={model.top_handle_length_in}, height={model.top_handle_height_in}, rear_edge={model.top_handle_rear_edge_to_center_in}")
        
        # ========================================
        # PRICING LOGIC (OPTIONAL - NEVER BLOCKS SAVE)
        # ========================================
        try:
            print("[PRICING] Checking if recalculation needed...")
            
            # Get last pricing snapshot to detect changes
            last_snapshot = db.query(ModelPricingSnapshot).filter(
                ModelPricingSnapshot.model_id == model.id,
                ModelPricingSnapshot.marketplace == "amazon"
            ).order_by(ModelPricingSnapshot.created_at.desc()).first()
            
            # Determine if pricing should be recalculated
            should_recalculate = False
            recalc_reason = None
            
            # Check if we have sufficient data for pricing
            has_dimensions = (
                model.width and model.width > 0 and
                model.depth and model.depth > 0 and
                model.height and model.height > 0
            )
            has_surface_area = surface_area and surface_area > 0
            
            if not has_dimensions or not has_surface_area:
                print(f"[PRICING] Skipped – insufficient dimensions (w={model.width}, d={model.depth}, h={model.height}, sa={surface_area})")
                should_recalculate = False
            elif not last_snapshot:
                # No pricing exists yet, but we now have dimensions
                should_recalculate = True
                recalc_reason = "No pricing snapshot exists and dimensions are now available"
                print(f"[PRICING] {recalc_reason}")
            else:
                # Compare current values to last pricing snapshot inputs
                print(f"[PRICING] Comparing current values to last snapshot from {last_snapshot.created_at}")
                
                # Pricing-relevant fields to check
                changes = []
                
                if last_snapshot.inputs_width != model.width:
                    changes.append(f"width: {last_snapshot.inputs_width} → {model.width}")
                if last_snapshot.inputs_depth != model.depth:
                    changes.append(f"depth: {last_snapshot.inputs_depth} → {model.depth}")
                if last_snapshot.inputs_height != model.height:
                    changes.append(f"height: {last_snapshot.inputs_height} → {model.height}")
                if last_snapshot.inputs_equipment_type_id != model.equipment_type_id:
                    changes.append(f"equipment_type_id: {last_snapshot.inputs_equipment_type_id} → {model.equipment_type_id}")
                
                # Check optional fields for changes (handle None comparisons)
                if last_snapshot.inputs_top_depth_in != model.top_depth_in:
                    changes.append(f"top_depth_in: {last_snapshot.inputs_top_depth_in} → {model.top_depth_in}")
                if last_snapshot.inputs_angle_drop_in != model.angle_drop_in:
                    changes.append(f"angle_drop_in: {last_snapshot.inputs_angle_drop_in} → {model.angle_drop_in}")
                if last_snapshot.inputs_handle_location_option_id != model.handle_location_option_id:
                    changes.append(f"handle_location_option_id: {last_snapshot.inputs_handle_location_option_id} → {model.handle_location_option_id}")
                if last_snapshot.inputs_angle_type_option_id != model.angle_type_option_id:
                    changes.append(f"angle_type_option_id: {last_snapshot.inputs_angle_type_option_id} → {model.angle_type_option_id}")
                
                if changes:
                    should_recalculate = True
                    recalc_reason = f"Pricing-relevant fields changed: {', '.join(changes)}"
                    print(f"[PRICING][UPDATE] changed_fields={', '.join(changes)}")
                else:
                    print("[PRICING][UPDATE] No pricing-relevant changes detected - skipping recalculation")
            
            # Conditional pricing recalculation
            if should_recalculate:
                print(f"[PRICING][UPDATE] running baseline recalculation - Reason: {recalc_reason}")
                try:
                    # Use 'amazon' marketplace to match what "Recalculate Baseline (Amazon)" button uses
                    PricingCalculator(db).calculate_model_prices(model.id, marketplace="amazon")
                    
                    # Query the created snapshots for logging
                    created_snapshots = db.query(ModelPricingSnapshot).filter(
                        ModelPricingSnapshot.model_id == model.id,
                        ModelPricingSnapshot.marketplace == "amazon"
                    ).order_by(ModelPricingSnapshot.created_at.desc()).limit(4).all()
                    
                    print(f"[PRICING][UPDATE] Recalculation successful - created/updated {len(created_snapshots)} snapshots")
                    for snapshot in created_snapshots:
                        print(f"[PRICING][UPDATE] wrote snapshot id={snapshot.id}, variant={snapshot.variant_key}, created_at={snapshot.created_at}")
                except Exception as pricing_error:
                    # Log but DO NOT block (model already saved)
                    print(f"[PRICING] Recalculation failed: {str(pricing_error)}")
                    print(f"[PRICING] Model saved anyway - pricing can be calculated later")
                    traceback.print_exc()
                    # DO NOT raise - pricing failure is not a save failure
        
        except Exception as pricing_check_error:
            # Catch ANY error in pricing logic to ensure it never blocks save
            print(f"[PRICING] Error in pricing logic: {str(pricing_check_error)}")
            print(f"[PRICING] Model saved successfully despite pricing error")
            traceback.print_exc()
            # DO NOT raise - model is already committed

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
