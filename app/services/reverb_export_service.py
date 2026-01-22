import csv
import io
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.core import Model, Series, Manufacturer, EquipmentType
from app.models.templates import ReverbTemplate, ReverbField, ReverbEquipmentTypeFieldOverride

def normalize_for_url(name: str) -> str:
    """Normalize a name for use in filenames."""
    if not name:
        return ''
    result = re.sub(r'[^a-zA-Z0-9]', '', name)
    return result

def substitute_placeholders(value: str, model: Model, series: Series, manufacturer: Manufacturer, equipment_type: EquipmentType, db: Session = None) -> str:
    """
    Replace [PLACEHOLDERS] in the value string with actual data.
    Supported: [MANUFACTURER_NAME], [SERIES_NAME], [MODEL_NAME], [EQUIPMENT_TYPE], [REVERB_PRICE]
    (and CamelCase variants)
    """
    if not value:
        return ""
        
    result = value
    mfr_name = manufacturer.name if manufacturer else ''
    series_name = series.name if series else ''
    model_name = model.name if model else ''
    equip_type = equipment_type.name if equipment_type else ''
    
    # Handle [REVERB_PRICE] placeholder - pulls Choice No Padding pricing
    if '[REVERB_PRICE]' in result or '[Reverb_Price]' in result:
        price_str = ""
        if db:
            from app.models.core import ModelPricingSnapshot
            # Query for Reverb Choice - No Padding pricing
            snapshot = db.query(ModelPricingSnapshot).filter(
                ModelPricingSnapshot.model_id == model.id,
                ModelPricingSnapshot.marketplace == "reverb",
                ModelPricingSnapshot.variant_key == "choice_no_padding"
            ).first()
            
            if snapshot:
                # Format as decimal string (e.g., "249.95")
                price_str = f"{snapshot.retail_price_cents / 100:.2f}"
        
        result = result.replace('[REVERB_PRICE]', price_str)
        result = result.replace('[Reverb_Price]', price_str)
    
    # Text-based substitution (no special image handling needed for Reverb CSV usually)
    result = result.replace('[MANUFACTURER_NAME]', mfr_name)
    result = result.replace('[SERIES_NAME]', series_name)
    result = result.replace('[MODEL_NAME]', model_name)
    result = result.replace('[EQUIPMENT_TYPE]', equip_type)
    
    result = result.replace('[Manufacturer_Name]', mfr_name)
    result = result.replace('[Series_Name]', series_name)
    result = result.replace('[Model_Name]', model_name)
    result = result.replace('[Equipment_Type]', equip_type)
    
    return result

def generate_reverb_export_csv(db: Session, model_ids: List[int]) -> tuple[io.BytesIO, str]:
    """
    Generate a Reverb CSV export for the given models.
    Returns (csv_buffer, filename).
    """
    if not model_ids:
        raise HTTPException(status_code=400, detail="No models selected")

    # 1. Fetch Models
    models = db.query(Model).filter(Model.id.in_(model_ids)).all()
    if not models:
        raise HTTPException(status_code=404, detail="No models found")

    # 2. Validate Reverb Template Compatibility
    # All models must map to the SAME Reverb Template ID.
    equipment_type_ids = set(m.equipment_type_id for m in models)
    equipment_types = db.query(EquipmentType).filter(EquipmentType.id.in_(equipment_type_ids)).all()
    
    template_ids = set()
    missing_template_et_names = []
    
    for et in equipment_types:
        if et.reverb_template_id:
            template_ids.add(et.reverb_template_id)
        else:
            missing_template_et_names.append(et.name)
            
    if missing_template_et_names:
        raise HTTPException(
            status_code=400, 
            detail=f"The following equipment types have no Reverb Template assigned: {', '.join(missing_template_et_names)}"
        )
        
    if len(template_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="Models belong to equipment types with DIFFERENT Reverb Templates. Please select models that share the same template."
        )
        
    if not template_ids:
        raise HTTPException(status_code=400, detail="No Reverb Template could be resolved.")

    template_id = list(template_ids)[0]
    template = db.query(ReverbTemplate).filter(ReverbTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Assigned Reverb Template not found")

    # 3. Load Template Fields
    fields = db.query(ReverbField).filter(ReverbField.reverb_template_id == template_id).order_by(ReverbField.order_index).all()
    
    # 3.5 Load Field Overrides for these Equipment Types
    overrides = db.query(ReverbEquipmentTypeFieldOverride).filter(
        ReverbEquipmentTypeFieldOverride.reverb_field_id.in_([f.id for f in fields]),
        ReverbEquipmentTypeFieldOverride.equipment_type_id.in_(equipment_type_ids)
    ).all()
    
    # Map: (equipment_type_id, field_id) -> override_value
    override_map = {(o.equipment_type_id, o.reverb_field_id): o.default_value for o in overrides}

    # 4. Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header Row
    header = [f.field_name for f in fields]
    writer.writerow(header)
    
    # Data Rows
    for model in models:
        # Resolve related entities for substitution
        series = db.query(Series).filter(Series.id == model.series_id).first()
        manufacturer = db.query(Manufacturer).filter(Manufacturer.id == series.manufacturer_id).first() if series else None
        eq_type = db.query(EquipmentType).filter(EquipmentType.id == model.equipment_type_id).first()
        
        row = []
        for field in fields:
            value = ""
            
            # Check for Override first
            override_val = override_map.get((model.equipment_type_id, field.id))
            
            if override_val is not None:
                value = substitute_placeholders(override_val, model, series, manufacturer, eq_type, db)
            elif field.custom_value:
                value = substitute_placeholders(field.custom_value, model, series, manufacturer, eq_type, db)
            elif field.selected_value:
                value = substitute_placeholders(field.selected_value, model, series, manufacturer, eq_type, db)
            
            row.append(value)
            
        writer.writerow(row)
        
    # 5. Prepare Output
    output.seek(0)
    bytes_buffer = io.BytesIO()
    bytes_buffer.write(output.getvalue().encode('utf-8'))
    bytes_buffer.seek(0)
    
    # Filename generation
    # Use first model metadata
    first_model = models[0]
    first_series = db.query(Series).filter(Series.id == first_model.series_id).first()
    first_mfr = db.query(Manufacturer).filter(Manufacturer.id == first_series.manufacturer_id).first() if first_series else None
    
    mfr_token = normalize_for_url(first_mfr.name) if first_mfr else "Unknown"
    series_token = normalize_for_url(first_series.name) if first_series else "Unknown"
    
    filename = f"Reverb_{mfr_token}_{series_token}_{template.original_filename}.csv"
    
    return bytes_buffer, filename
