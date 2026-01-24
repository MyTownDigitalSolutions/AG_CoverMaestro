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

def substitute_placeholders(value: str, model: Model, series: Series, manufacturer: Manufacturer, equipment_type: EquipmentType, db: Session = None, context: Dict[str, Any] = None, numeric_zero_default: bool = False, is_image_url: bool = False) -> str:
    """
    Replace [PLACEHOLDERS] in the value string with actual data.
    Supported: [MANUFACTURER_NAME], [SERIES_NAME], [MODEL_NAME], [EQUIPMENT_TYPE], [REVERB_PRICE]
    Dynamic Design Option placeholders (e.g. [SIDE_POCKET]).
    AND [SUM: [Option A] + [Option B] ] logic.
    """
    if not value:
        return ""
        
    result = value
    
    # 0. Handle [SUM: ...] blocks first via Manual Parsing (to handle nested brackets)
    while '[SUM:' in result:
        start_idx = result.find('[SUM:')
        if start_idx == -1:
            break
            
        # Find matching closing bracket
        balance = 0
        end_idx = -1
        content_start = start_idx + 5 # Length of "[SUM:"
        
        for i in range(start_idx, len(result)):
            char = result[i]
            if char == '[':
                balance += 1
            elif char == ']':
                balance -= 1
                
            if balance == 0:
                end_idx = i
                break
        
        if end_idx != -1:
            # We found the block
            full_match = result[start_idx:end_idx+1] # [SUM:...]
            content = result[content_start:end_idx]  # Inner content
            
            # Recursive call with numeric mode forced to True
            resolved_content = substitute_placeholders(
                content, model, series, manufacturer, equipment_type, db, context, 
                numeric_zero_default=True
            )
            
            replacement = full_match # Fallback
            
            try:
                # Split by | (pipe), strip whitespace
                parts = [p.strip() for p in resolved_content.split('|')]
                # Filter empty parts and parse floats
                total = sum(float(p) for p in parts if p)
                replacement = f"{total:.2f}"
            except Exception as e:
                replacement = f"[SUM_ERROR: {content} -> {str(e)}]"
            
            # Replace only the first occurrence (safe because we loop)
            result = result.replace(full_match, replacement, 1)
        else:
            # Malformed/Unclosed SUM block - break to avoid infinite loop
            break

    mfr_name = manufacturer.name if manufacturer else ''
    series_name = series.name if series else ''
    model_name = model.name if model else ''
    equip_type = equipment_type.name if equipment_type else ''
    
    # Apply URL normalization if requested (matches Amazon export logic)
    if is_image_url:
        def img_norm(s):
            if not s: return ''
            # Replace whitespace sequences with underscore, keep other chars including punctuation
            return re.sub(r'\s+', '_', s.strip())

        mfr_name = img_norm(mfr_name)
        series_name = img_norm(series_name)
        model_name = img_norm(model_name)
        equip_type = img_norm(equip_type)
    
    # 1. Handle Dynamic Design Option Placeholders
    # Context must contain 'design_option_map' (Token->Obj) and 'et_assignments' (Set[DO_ID])
    if context and 'design_option_map' in context:
        do_map = context['design_option_map']
        et_assignments = context.get('et_assignments', set())
        
        for token, option in do_map.items():
            if token in result:
                # Found a placeholder!
                # Check if this option is assigned to this Equipment Type
                replacement = ""
                if option.id in et_assignments:
                    # It is assigned! Format price.
                    replacement = f"{(option.price_cents / 100):.2f}"
                elif numeric_zero_default:
                   # Inside SUM block, unassigned = 0
                   replacement = "0"
                
                # Replace token
                result = result.replace(token, replacement)

    # Handle [REVERB_PRICE] placeholders
    variant_map = {
        '[REVERB_PRICE]': 'choice_no_padding',
        '[Reverb_Price]': 'choice_no_padding',
        '[REVERB_PRICE_CHOICE_NP]': 'choice_no_padding',
        '[REVERB_PRICE_CHOICE_P]': 'choice_padded',
        '[REVERB_PRICE_PREMIUM_NP]': 'premium_no_padding',
        '[REVERB_PRICE_PREMIUM_P]': 'premium_padded'
    }

    if db:
        from app.models.core import ModelPricingSnapshot
        
        # Check if any supported placeholder exists in the string
        found_placeholders = [p for p in variant_map.keys() if p in result]
        
        if found_placeholders:
            snapshots = db.query(ModelPricingSnapshot).filter(
                ModelPricingSnapshot.model_id == model.id,
                ModelPricingSnapshot.marketplace == "reverb"
            ).all()
            
            snap_dict = {s.variant_key: s for s in snapshots}
            
            for ph in found_placeholders:
                target_key = variant_map[ph]
                snapshot = snap_dict.get(target_key)
                
                price_str = ""
                if snapshot:
                    price_str = f"{snapshot.retail_price_cents / 100:.2f}"
                elif numeric_zero_default:
                    price_str = "0"
                
                result = result.replace(ph, price_str)
    
    # Text-based substitution (no special image handling needed for Reverb CSV usually)
    result = result.replace('[MANUFACTURER_NAME]', mfr_name)
    result = result.replace('[SERIES_NAME]', series_name)
    result = result.replace('[MODEL_NAME]', model_name)
    result = result.replace('[EQUIPMENT_TYPE]', equip_type)
    
    # [SKU] placeholder - Maps to model.parent_sku
    sku_val = model.parent_sku if model.parent_sku else "0" if numeric_zero_default else ""
    result = result.replace('[SKU]', sku_val)
    result = result.replace('[Sku]', sku_val)
    result = result.replace('[sku]', sku_val)
    
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

    # 2. Resolve Reverb Template
    # User Requirement: "Reverb only has 1 template" -> Use the latest one globally.
    # Ignore explicit linking in EquipmentType.
    
    template = db.query(ReverbTemplate).order_by(ReverbTemplate.uploaded_at.desc(), ReverbTemplate.id.desc()).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="No Reverb Template found in the system. Please upload one.")

    template_id = template.id

    # 3. Load Template Fields
    fields = db.query(ReverbField).filter(ReverbField.reverb_template_id == template_id).order_by(ReverbField.order_index).all()
    
    # 3.5 Load Field Overrides for these Equipment Types
    equipment_type_ids = set(m.equipment_type_id for m in models)
    overrides = db.query(ReverbEquipmentTypeFieldOverride).filter(
        ReverbEquipmentTypeFieldOverride.reverb_field_id.in_([f.id for f in fields]),
        ReverbEquipmentTypeFieldOverride.equipment_type_id.in_(equipment_type_ids)
    ).all()
    
    # Map: (equipment_type_id, field_id) -> override_value
    override_map = {(o.equipment_type_id, o.reverb_field_id): o.default_value for o in overrides}

    # 3.6 Determine "Strict Mode" for specific fields
    # If Product Type, Subcategory, or Description has ANY overrides defined in the system
    # (even for ETs not currently being exported), we disable 'Global Default' fallback.
    # This prevents e.g. "Accessories" default from applying to "Guitar Amps" just because
    # "Guitar Amps" wasn't explicitly assigned yet.
    
    strict_fields = ['product_type', 'subcategory_1', 'description']
    strict_field_ids = {f.id for f in fields if f.field_name.lower() in strict_fields}
    
    fields_with_overrides = set()
    if strict_field_ids:
        # Check if these fields have ANY overrides in the entire DB?
        # Or just trust that if the user started overriding, they mean it.
        # Efficient query:
        rows = db.query(ReverbEquipmentTypeFieldOverride.reverb_field_id).filter(
            ReverbEquipmentTypeFieldOverride.reverb_field_id.in_(strict_field_ids)
        ).distinct().all()
        fields_with_overrides = {r[0] for r in rows}

    # 3.7 Load Design Option Placeholders
    # Optimization: Pre-load all design options with tokens and their ET assignments
    from app.models.core import DesignOption, EquipmentTypeDesignOption
    
    design_options_with_tokens = db.query(DesignOption).filter(
        DesignOption.placeholder_token.isnot(None),
        DesignOption.placeholder_token != ''
    ).all()
    
    # Map: Token -> DesignOption
    do_token_map = {opt.placeholder_token: opt for opt in design_options_with_tokens}
    
    # Map: EquipmentTypeID -> Set of DesignOptionIDs
    # Only for the options that have tokens
    do_ids = [opt.id for opt in design_options_with_tokens]
    
    # We only care about models in this batch, so filter by their ETs?
    # Or just query all for these options (safer/simpler if list is small)
    et_do_links = db.query(EquipmentTypeDesignOption).filter(
        EquipmentTypeDesignOption.design_option_id.in_(do_ids)
    ).all()
    
    et_do_map = {} # ET_ID -> Set(DO_ID)
    for link in et_do_links:
        if link.equipment_type_id not in et_do_map:
            et_do_map[link.equipment_type_id] = set()
        et_do_map[link.equipment_type_id].add(link.design_option_id)

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
        
        # Prepare context for substitution
        context = {
            'design_option_map': do_token_map,
            'et_assignments': et_do_map.get(model.equipment_type_id, set())
        }
        
        row = []
        for field in fields:
            value = ""
            
            # Check for Override first (Always Priority)
            override_val = override_map.get((model.equipment_type_id, field.id))
            
            # Determine if this is likely an image URL field/value for underscore normalization
            is_potential_image = (
                'photo' in field.field_name.lower() or 
                'image' in field.field_name.lower() or 
                'url' in field.field_name.lower()
            )
            
            if override_val is not None:
                is_url_val = is_potential_image or (override_val and override_val.strip().lower().startswith(('http', 'www', 'ftp')))
                value = substitute_placeholders(override_val, model, series, manufacturer, eq_type, db, context, is_image_url=is_url_val)
            else:
                # No override found. Should we use Global Default?
                # Check Strict Mode
                is_strict = (field.id in fields_with_overrides)
                
                if not is_strict:
                    # Safe to use defaults
                    if field.custom_value:
                        is_url_val = is_potential_image or (field.custom_value and field.custom_value.strip().lower().startswith(('http', 'www', 'ftp')))
                        value = substitute_placeholders(field.custom_value, model, series, manufacturer, eq_type, db, context, is_image_url=is_url_val)
                    elif field.selected_value:
                        is_url_val = is_potential_image or (field.selected_value and field.selected_value.strip().lower().startswith(('http', 'www', 'ftp')))
                        value = substitute_placeholders(field.selected_value, model, series, manufacturer, eq_type, db, context, is_image_url=is_url_val)
                else:
                    # Strict Mode: Do not use defaults unless... is there an exception?
                    pass
            
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
    
    from datetime import datetime
    date_str = datetime.now().strftime('%Y-%m-%d')
    filename = f"Reverb_{mfr_token}_{series_token}_{date_str}.csv"
    
    return bytes_buffer, filename
