from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import get_db
from app.models.core import (
    Model, Material, MaterialColourSurcharge, DesignOption, 
    PricingOption, ModelVariationSKU
)

router = APIRouter(prefix="/ebay-variations", tags=["eBay Variations"])


class GenerateVariationsRequest(BaseModel):
    model_ids: List[int]
    material_id: int
    material_colour_surcharge_id: Optional[int] = None
    design_option_ids: List[int] = []
    pricing_option_ids: List[int] = []


class VariationRow(BaseModel):
    model_id: int
    sku: str
    material_id: int
    material_colour_surcharge_id: Optional[int]
    design_option_ids: List[int]
    pricing_option_ids: List[int]


class GenerateVariationsResponse(BaseModel):
    created: int
    updated: int
    errors: List[str]
    rows: List[VariationRow]


@router.post("/generate", response_model=GenerateVariationsResponse)
def generate_variations(
    data: GenerateVariationsRequest,
    db: Session = Depends(get_db)
):
    """
    Generate and persist variation SKUs for selected models and options.
    
    Returns a preview of the generated SKUs and persists them to the database.
    """
    
    # Validation: Check abbreviations
    validation_errors = []
    
    # Validate material
    material = db.query(Material).filter(Material.id == data.material_id).first()
    if not material:
        raise HTTPException(status_code=400, detail=f"Material {data.material_id} not found")
    
    if not material.sku_abbreviation or len(material.sku_abbreviation) != 3:
        validation_errors.append(f"Material {data.material_id} has invalid/missing SKU abbreviation (must be exactly 3 characters)")
    
    # Validate color if provided
    material_surcharge = None
    if data.material_colour_surcharge_id:
        material_surcharge = db.query(MaterialColourSurcharge).filter(
            MaterialColourSurcharge.id == data.material_colour_surcharge_id
        ).first()
        if not material_surcharge:
            raise HTTPException(status_code=400, detail=f"Material colour surcharge {data.material_colour_surcharge_id} not found")
        
        if not material_surcharge.sku_abbreviation or len(material_surcharge.sku_abbreviation) != 3:
            validation_errors.append(f"Color {data.material_colour_surcharge_id} has invalid/missing SKU abbreviation (must be exactly 3 characters)")
    
    # Validate design options
    design_options = []
    if data.design_option_ids:
        design_options = db.query(DesignOption).filter(
            DesignOption.id.in_(data.design_option_ids)
        ).all()
        
        if len(design_options) != len(data.design_option_ids):
            found_ids = {opt.id for opt in design_options}
            missing_ids = set(data.design_option_ids) - found_ids
            raise HTTPException(status_code=400, detail=f"Design options not found: {list(missing_ids)}")
        
        for opt in design_options:
            if not opt.sku_abbreviation or len(opt.sku_abbreviation) != 3:
                validation_errors.append(f"Design option {opt.id} ({opt.name}) has invalid/missing SKU abbreviation (must be exactly 3 characters)")
    
    # Validate pricing options
    pricing_options = []
    if data.pricing_option_ids:
        pricing_options = db.query(PricingOption).filter(
            PricingOption.id.in_(data.pricing_option_ids)
        ).all()
        
        if len(pricing_options) != len(data.pricing_option_ids):
            found_ids = {opt.id for opt in pricing_options}
            missing_ids = set(data.pricing_option_ids) - found_ids
            raise HTTPException(status_code=400, detail=f"Pricing options not found: {list(missing_ids)}")
        
        for opt in pricing_options:
            if not opt.sku_abbreviation or len(opt.sku_abbreviation) != 3:
                validation_errors.append(f"Pricing option {opt.id} ({opt.name}) has invalid/missing SKU abbreviation (must be exactly 3 characters)")
    
    # If validation errors found, return 400
    if validation_errors:
        raise HTTPException(status_code=400, detail="; ".join(validation_errors))
    
    # Fetch models
    models = db.query(Model).filter(Model.id.in_(data.model_ids)).all()
    if len(models) != len(data.model_ids):
        found_ids = {m.id for m in models}
        missing_ids = set(data.model_ids) - found_ids
        raise HTTPException(status_code=400, detail=f"Models not found: {list(missing_ids)}")
    
    # Generate SKUs and upsert
    created_count = 0
    updated_count = 0
    rows = []
    
    # Sort design and pricing options by ID for deterministic order
    sorted_design_opts = sorted(design_options, key=lambda x: x.id)
    sorted_pricing_opts = sorted(pricing_options, key=lambda x: x.id)
    
    for model in models:
        # Build deterministic SKU
        # Base: use model's base_sku if it exists, otherwise MODEL-{id}
        base_sku = getattr(model, 'base_sku', None) or getattr(model, 'sku', None) or f"MODEL-{model.id}"
        
        # Build SKU tokens in order
        sku_parts = [base_sku]
        sku_parts.append(f"M{material.sku_abbreviation}")
        
        if material_surcharge and material_surcharge.sku_abbreviation:
            sku_parts.append(f"C{material_surcharge.sku_abbreviation}")
        
        for opt in sorted_design_opts:
            sku_parts.append(f"D{opt.sku_abbreviation}")
        
        for opt in sorted_pricing_opts:
            sku_parts.append(f"P{opt.sku_abbreviation}")
        
        final_sku = "-".join(sku_parts)
        
        # Check if variation already exists
        existing = db.query(ModelVariationSKU).filter(
            and_(
                ModelVariationSKU.model_id == model.id,
                ModelVariationSKU.material_id == data.material_id,
                ModelVariationSKU.material_colour_surcharge_id == data.material_colour_surcharge_id,
                ModelVariationSKU.design_option_ids == data.design_option_ids,
                ModelVariationSKU.pricing_option_ids == data.pricing_option_ids
            )
        ).first()
        
        if existing:
            # Update
            existing.sku = final_sku
            updated_count += 1
        else:
            # Insert
            new_variation = ModelVariationSKU(
                model_id=model.id,
                sku=final_sku,
                material_id=data.material_id,
                material_colour_surcharge_id=data.material_colour_surcharge_id,
                design_option_ids=data.design_option_ids,
                pricing_option_ids=data.pricing_option_ids,
                is_parent=False,
                retail_price_cents=None
            )
            db.add(new_variation)
            created_count += 1
        
        # Add to response rows
        rows.append(VariationRow(
            model_id=model.id,
            sku=final_sku,
            material_id=data.material_id,
            material_colour_surcharge_id=data.material_colour_surcharge_id,
            design_option_ids=data.design_option_ids,
            pricing_option_ids=data.pricing_option_ids
        ))
    
    # Commit changes
    db.commit()
    
    return GenerateVariationsResponse(
        created=created_count,
        updated=updated_count,
        errors=[],
        rows=rows
    )
