import re
import io
import csv
import json
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel
from app.schemas.core import ModelPricingSnapshotResponse
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from app.database import get_db
from app.models.core import Model, Series, Manufacturer, EquipmentType, ModelPricingSnapshot
from app.models.templates import AmazonProductType, ProductTypeField, EquipmentTypeProductType

from app.schemas.core import ModelPricingSnapshotResponse
from app.api.pricing import recalculate_targeted, PricingRecalculateRequest
from app.services.pricing_calculator import PricingConfigError

router = APIRouter(prefix="/export", tags=["export"])

# --------------------------------------------------------------------------
# Staleness Check Helper
# --------------------------------------------------------------------------
def ensure_models_fresh_for_export(request: ExportPreviewRequest, db: Session) -> tuple[bool, int]:
    """
    Check if any selected model has stale pricing (or missing baseline snapshots).
    If so, trigger a targeted recalculation before export proceeds.
    Returns (recalc_performed: bool, recalc_model_count: int).
    """
    if not request.model_ids:
        return False, 0
        
    recalc_req = PricingRecalculateRequest(
        model_ids=request.model_ids,
        only_if_stale=True
    )
    
    # Direct service logic reuse via the API function, 
    # but we must ensure we don't double-wrap or mis-handle dependencies.
    # calling the route function directly is acceptable in FastAPI if deps match.
    # alternatively, extract the logic. 
    # For chunks, calling the route function is safest "minimal change" 
    # as long as we pass 'db'.
    
    try:
        resp = recalculate_targeted(recalc_req, db)
    except PricingConfigError as e:
        # If the underlying recalc fails due to config (e.g. fixed cell missing),
        # we must abort export and tell the user.
        raise HTTPException(status_code=400, detail=f"Export failed during pricing check: {str(e)}")
    
    return (resp.recalculated_models > 0), resp.recalculated_models

@router.get("/debug-price/{model_id}", response_model=ModelPricingSnapshotResponse)
def get_debug_price(model_id: int, db: Session = Depends(get_db)):
    """
    Get the baseline pricing snapshot for this model (Amazon / Choice No Padding).
    Used for UI debugging and validation.
    """
    snap = db.query(ModelPricingSnapshot).filter(
        ModelPricingSnapshot.model_id == model_id,
        ModelPricingSnapshot.marketplace == "amazon",
        ModelPricingSnapshot.variant_key == "choice_no_padding"
    ).first()
    
    if not snap:
        raise HTTPException(status_code=404, detail="Baseline snapshot not found. Please recalculate pricing or run seed.")
        
    return snap

class ExportPreviewRequest(BaseModel):
    model_ids: List[int]
    listing_type: str = "individual"  # "individual" or "parent_child"

class ExportRowData(BaseModel):
    model_id: int
    model_name: str
    data: List[str | None]

class ExportPreviewResponse(BaseModel):
    headers: List[List[str | None]]
    rows: List[ExportRowData]
    template_code: str
    export_signature: str
    field_map: Dict[str, int]
    audit: Dict[str, Any]
    recalc_performed: bool = False
    recalc_model_count: int = 0

def compute_export_signature(template_code: str, header_rows: list, data_rows: list) -> str:
    """
    Compute a deterministic SHA256 signature for the export content.
    Normalization Rules: None -> "", all values to strings, no trimming.
    """
    def normalize_row(row):
        return [str(val) if val is not None else "" for val in row]

    payload = {
        "template_code": template_code,
        "headers": [normalize_row(r) for r in header_rows],
        "rows": [normalize_row(r) for r in data_rows]
    }
    
    # Serialize to JSON with sorted keys to ensure determinism if we expanded payload
    # For now, keys are fixed. separators=(",", ":") removes whitespace.
    serialized = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    
    return hashlib.sha256(serialized.encode('utf-8')).hexdigest()

def is_price_field(field_name: str) -> bool:
    """Exact logic from get_field_value triggering price population."""
    field_name_lower = field_name.lower()
    return "purchasable_offer[marketplace_id=atvpdkikx0der]" in field_name_lower and \
           "our_price#1.schedule#1.value_with_tax" in field_name_lower

def is_sku_related_field(field_name: str) -> bool:
    """True if field relates to SKU logic."""
    lower = field_name.lower()
    keys = ["item_sku", "contribution_sku", "parent_sku", "parent_child", "relationship_type"]
    return any(k in lower for k in keys)

def build_audit_columns(ordered_field_names: List[str], ordered_required_flags: List[bool]) -> List[dict]:
    """Identify which columns correspond to price and sku fields."""
    audited = []
    for idx, (name, required) in enumerate(zip(ordered_field_names, ordered_required_flags)):
        if not required:
            # Skip audit for fields that are not exported/populated
            continue
            
        if is_price_field(name):
            audited.append({"field_name": name, "column_index": idx, "type": "PRICE"})
        elif is_sku_related_field(name):
            audited.append({"field_name": name, "column_index": idx, "type": "SKU"})
    return audited

# Example usage:
# signature = compute_export_signature(code, headers, rows)

@router.post("/preview", response_model=ExportPreviewResponse)
def generate_export_preview(request: ExportPreviewRequest, db: Session = Depends(get_db)):
    recalc_performed, recalc_count = ensure_models_fresh_for_export(request, db)

    header_rows, data_rows, filename_base, template_code, models, ordered_field_names, ordered_required_flags = build_export_data(request, db)
    
    signature = compute_export_signature(template_code, header_rows, data_rows)
    field_map = {name: idx for idx, name in enumerate(ordered_field_names)}
    
    # Audit Construction
    audit_columns = build_audit_columns(ordered_field_names, ordered_required_flags)
    matched_price_fields = []
    matched_sku_fields = []
    
    for col in audit_columns:
        if col["type"] == "PRICE":
            matched_price_fields.append({
                "field_name": col["field_name"],
                "column_index": col["column_index"],
                "rule_explanation": (
                    "Price is populated from the Amazon US baseline pricing snapshot "
                    "(variant: choice_no_padding). Export fails if snapshot is missing."
                ),
                "source": {
                    "marketplace": "amazon",
                    "variant_key": "choice_no_padding",
                    "entity": "ModelPricingSnapshot",
                    "field": "retail_price_cents"
                }
            })
        elif col["type"] == "SKU":
             explanation = "Value is derived from the model base SKU."
             if "contribution_sku" in col["field_name"].lower() and request.listing_type == "individual":
                 explanation += " In individual listings, contribution_sku uses the base/parent SKU."
                 
             matched_sku_fields.append({
                "field_name": col["field_name"],
                "column_index": col["column_index"],
                "rule_explanation": explanation
            })

    row_samples = []
    for i in range(min(5, len(data_rows))):
        row = data_rows[i]
        model = models[i]
        
        key_values = {}
        for col in audit_columns:
            # Safely get value if index is within bounds, though it should be
            idx = col["column_index"]
            if idx < len(row):
                key_values[col["field_name"]] = row[idx]
        
        row_samples.append({
            "model_id": model.id,
            "model_name": model.name,
            "key_values": key_values
        })

    audit = {
        "row_mode": "BASE",
        "pricing": {
            "matched_price_fields": matched_price_fields
        },
        "sku": {
            "matched_sku_fields": matched_sku_fields
        },
        "row_samples": row_samples
    }
    
    rows = []
    # Reconstruct ExportRowData objects from the raw data and model objects
    # We rely on the order of 'models' and 'data_rows' matching, which they do in build_export_data
    for i, row_data in enumerate(data_rows):
        rows.append(ExportRowData(
            model_id=models[i].id,
            model_name=models[i].name,
            data=row_data
        ))
    
    return ExportPreviewResponse(
        headers=header_rows,
        rows=rows,
        template_code=template_code,
        export_signature=signature,
        field_map=field_map,
        audit=audit,
        recalc_performed=recalc_performed,
        recalc_model_count=recalc_count
    )


from datetime import datetime

def build_export_data(request: ExportPreviewRequest, db: Session):
    """Build export data (headers and rows) for the given models."""
    if not request.model_ids:
        raise HTTPException(status_code=400, detail="No models selected")
    
    models = db.query(Model).filter(Model.id.in_(request.model_ids)).all()
    if not models:
        raise HTTPException(status_code=404, detail="No models found")
    
    equipment_type_ids = set(m.equipment_type_id for m in models)
    if len(equipment_type_ids) > 1:
        raise HTTPException(
            status_code=400, 
            detail="All selected models must have the same equipment type for export"
        )
    
    equipment_type_id = list(equipment_type_ids)[0]
    
    link = db.query(EquipmentTypeProductType).filter(
        EquipmentTypeProductType.equipment_type_id == equipment_type_id
    ).first()
    
    if not link:
        equipment_type = db.query(EquipmentType).filter(EquipmentType.id == equipment_type_id).first()
        raise HTTPException(
            status_code=400, 
            detail=f"No Amazon template linked to equipment type: {equipment_type.name if equipment_type else 'Unknown'}"
        )
    
    product_type = db.query(AmazonProductType).filter(
        AmazonProductType.id == link.product_type_id
    ).first()
    
    if not product_type:
        raise HTTPException(status_code=404, detail="Template not found")
    
    fields = db.query(ProductTypeField).filter(
        ProductTypeField.product_type_id == product_type.id
    ).order_by(ProductTypeField.order_index).all()
    
    header_rows = product_type.header_rows or []
    
    equipment_type = db.query(EquipmentType).filter(EquipmentType.id == equipment_type_id).first()
    
    first_model = models[0]
    first_series = db.query(Series).filter(Series.id == first_model.series_id).first()
    first_manufacturer = db.query(Manufacturer).filter(Manufacturer.id == first_series.manufacturer_id).first() if first_series else None
    
    mfr_name = normalize_for_url(first_manufacturer.name) if first_manufacturer else 'Unknown'
    series_name = normalize_for_url(first_series.name) if first_series else 'Unknown'
    date_str = datetime.now().strftime('%Y%m%d')
    filename_base = f"Amazon_{mfr_name}_{series_name}_{date_str}"
    
    data_rows = []
    for model in models:
        series = db.query(Series).filter(Series.id == model.series_id).first()
        manufacturer = db.query(Manufacturer).filter(Manufacturer.id == series.manufacturer_id).first() if series else None
        
        row_data = []
        for field in fields:
            if not field.required:
                row_data.append("")
                continue

            value = get_field_value(field, model, series, manufacturer, equipment_type, request.listing_type, db)
            row_data.append(value if value else '')
        
        data_rows.append(row_data)
    
    ordered_field_names = [f.field_name for f in fields]
    ordered_required_flags = [f.required for f in fields]
    return header_rows, data_rows, filename_base, product_type.code, models, ordered_field_names, ordered_required_flags


@router.post("/download/xlsx")
def download_xlsx(request: ExportPreviewRequest, db: Session = Depends(get_db)):
    """Download export as XLSX file."""
    ensure_models_fresh_for_export(request, db)
    header_rows, data_rows, filename_base, template_code, _, _, _ = build_export_data(request, db)
    
    sig = compute_export_signature(template_code, header_rows, data_rows)
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Template"
    
    row_styles = [
        (Font(bold=True, color="FFFFFF"), PatternFill(start_color="1976D2", end_color="1976D2", fill_type="solid")),
        (Font(color="FFFFFF"), PatternFill(start_color="2196F3", end_color="2196F3", fill_type="solid")),
        (Font(bold=True, color="FFFFFF"), PatternFill(start_color="4CAF50", end_color="4CAF50", fill_type="solid")),
        (Font(bold=True), PatternFill(start_color="8BC34A", end_color="8BC34A", fill_type="solid")),
        (Font(size=9), PatternFill(start_color="C8E6C9", end_color="C8E6C9", fill_type="solid")),
        (Font(italic=True, size=9), PatternFill(start_color="FFF9C4", end_color="FFF9C4", fill_type="solid")),
    ]
    
    current_row = 1
    for row_idx, header_row in enumerate(header_rows):
        for col_idx, value in enumerate(header_row):
            cell = ws.cell(row=current_row, column=col_idx + 1, value=value or '')
            if row_idx < len(row_styles):
                cell.font = row_styles[row_idx][0]
                cell.fill = row_styles[row_idx][1]
            cell.alignment = Alignment(horizontal='left', vertical='center')
        current_row += 1
    
    for data_row in data_rows:
        for col_idx, value in enumerate(data_row):
            ws.cell(row=current_row, column=col_idx + 1, value=value or '')
        current_row += 1
    
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = min(len(str(cell.value)), 50)
            except:
                pass
        adjusted_width = max_length + 2
        ws.column_dimensions[column].width = adjusted_width
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"{filename_base}.xlsx"
    response = StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    response.headers["X-Export-Signature"] = sig
    response.headers["X-Export-Template-Code"] = template_code
    return response


@router.post("/download/xlsm")
def download_xlsm(request: ExportPreviewRequest, db: Session = Depends(get_db)):
    """Download export as XLSM file (macro-enabled workbook)."""
    ensure_models_fresh_for_export(request, db)
    header_rows, data_rows, filename_base, template_code, _, _, _ = build_export_data(request, db)

    sig = compute_export_signature(template_code, header_rows, data_rows)
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Template"
    
    row_styles = [
        (Font(bold=True, color="FFFFFF"), PatternFill(start_color="1976D2", end_color="1976D2", fill_type="solid")),
        (Font(color="FFFFFF"), PatternFill(start_color="2196F3", end_color="2196F3", fill_type="solid")),
        (Font(bold=True, color="FFFFFF"), PatternFill(start_color="4CAF50", end_color="4CAF50", fill_type="solid")),
        (Font(bold=True), PatternFill(start_color="8BC34A", end_color="8BC34A", fill_type="solid")),
        (Font(size=9), PatternFill(start_color="C8E6C9", end_color="C8E6C9", fill_type="solid")),
        (Font(italic=True, size=9), PatternFill(start_color="FFF9C4", end_color="FFF9C4", fill_type="solid")),
    ]
    
    current_row = 1
    for row_idx, header_row in enumerate(header_rows):
        for col_idx, value in enumerate(header_row):
            cell = ws.cell(row=current_row, column=col_idx + 1, value=value or '')
            if row_idx < len(row_styles):
                cell.font = row_styles[row_idx][0]
                cell.fill = row_styles[row_idx][1]
            cell.alignment = Alignment(horizontal='left', vertical='center')
        current_row += 1
    
    for data_row in data_rows:
        for col_idx, value in enumerate(data_row):
            ws.cell(row=current_row, column=col_idx + 1, value=value or '')
        current_row += 1
    
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = min(len(str(cell.value)), 50)
            except:
                pass
        adjusted_width = max_length + 2
        ws.column_dimensions[column].width = adjusted_width
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"{filename_base}.xlsm"
    response = StreamingResponse(
        output,
        media_type="application/vnd.ms-excel.sheet.macroEnabled.12",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    response.headers["X-Export-Signature"] = sig
    response.headers["X-Export-Template-Code"] = template_code
    return response


@router.post("/download/csv")
def download_csv(request: ExportPreviewRequest, db: Session = Depends(get_db)):
    """Download export as CSV file."""
    ensure_models_fresh_for_export(request, db)
    header_rows, data_rows, filename_base, template_code, _, _, _ = build_export_data(request, db)
    
    sig = compute_export_signature(template_code, header_rows, data_rows)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    for header_row in header_rows:
        writer.writerow([v or '' for v in header_row])
    
    for data_row in data_rows:
        writer.writerow([v or '' for v in data_row])
    
    content = output.getvalue().encode('utf-8')
    
    filename = f"{filename_base}.csv"
    response = StreamingResponse(
        iter([content]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    response.headers["X-Export-Signature"] = sig
    response.headers["X-Export-Template-Code"] = template_code
    return response


IMAGE_FIELD_TO_NUMBER = {
    'main_product_image_locator': '001',
    'other_product_image_locator_1': '002',
    'other_product_image_locator_2': '003',
    'other_product_image_locator_3': '004',
    'other_product_image_locator_4': '005',
    'other_product_image_locator_5': '006',
    'other_product_image_locator_6': '007',
    'other_product_image_locator_7': '008',
    'other_product_image_locator_8': '009',
    'swatch_product_image_locator': '010',
}

def normalize_for_url(name: str) -> str:
    """Normalize a name for use in URL paths/filenames.
    Removes spaces, special characters, and non-alphanumeric characters.
    Example: "Fender USA" -> "FenderUSA", "Tone-Master" -> "ToneMaster"
    """
    if not name:
        return ''
    result = re.sub(r'[^a-zA-Z0-9]', '', name)
    return result

def substitute_placeholders(value: str, model: Model, series, manufacturer, equipment_type, is_image_url: bool = False) -> str:
    result = value
    mfr_name = manufacturer.name if manufacturer else ''
    series_name = series.name if series else ''
    model_name = model.name if model else ''
    equip_type = equipment_type.name if equipment_type else ''
    
    if is_image_url:
        mfr_name_norm = normalize_for_url(mfr_name)
        series_name_norm = normalize_for_url(series_name)
        model_name_norm = normalize_for_url(model_name)
        
        result = result.replace('[Manufacturer_Name]', mfr_name_norm)
        result = result.replace('[Series_Name]', series_name_norm)
        result = result.replace('[Model_Name]', model_name_norm)
        result = result.replace('[MANUFACTURER_NAME]', mfr_name_norm)
        result = result.replace('[SERIES_NAME]', series_name_norm)
        result = result.replace('[MODEL_NAME]', model_name_norm)
    else:
        result = result.replace('[MANUFACTURER_NAME]', mfr_name)
        result = result.replace('[SERIES_NAME]', series_name)
        result = result.replace('[MODEL_NAME]', model_name)
        result = result.replace('[Manufacturer_Name]', mfr_name)
        result = result.replace('[Series_Name]', series_name)
        result = result.replace('[Model_Name]', model_name)
    
    result = result.replace('[EQUIPMENT_TYPE]', equip_type)
    result = result.replace('[Equipment_Type]', equip_type)
    
    return result

def get_image_field_key(field_name: str) -> str | None:
    """Extract the base image field key from a full Amazon field name.
    Returns the key if it matches a known product image field, None otherwise.
    """
    for key in IMAGE_FIELD_TO_NUMBER.keys():
        if field_name.startswith(key):
            return key
    return None

def is_image_url_field(field_name: str) -> bool:
    """Check if a field is a product image URL field that needs special processing."""
    return get_image_field_key(field_name) is not None

def get_amazon_us_baseline_price_str(db: Session, model_id: int) -> str:
    """
    Fetch the baseline retail price (Choice Waterproof No Padding) for Amazon US.
    Format: "249.95" (2 decimals)
    Strict Rule: Fail if snapshot is missing.
    """
    snapshot = db.query(ModelPricingSnapshot).filter(
        ModelPricingSnapshot.model_id == model_id,
        ModelPricingSnapshot.marketplace == "amazon",
        ModelPricingSnapshot.variant_key == "choice_no_padding"
    ).first()

    if not snapshot:
        # Prompt: "If baseline snapshot row is missing, fail the export for that model with a clear message"
        # Since this is deep in the call stack for a specific field, raising HTTPException here
        # will abort the entire request, which is desired.
        raise HTTPException(
            status_code=400, 
            detail=f"Missing baseline pricing snapshot for Choice Waterproof (no padding). Run pricing recalculation for model {model_id} on 'amazon' marketplace before exporting."
        )
    
    return f"{snapshot.retail_price_cents / 100:.2f}"

def get_field_value(field: ProductTypeField, model: Model, series, manufacturer, equipment_type=None, listing_type: str = "individual", db: Session = None) -> str | None:
    field_name_lower = field.field_name.lower()
    is_image_field = is_image_url_field(field.field_name)
    
    # Phase 9: Amazon Baseline Price Logic
    # check specific field key parts
    if "purchasable_offer[marketplace_id=atvpdkikx0der]" in field_name_lower and "our_price#1.schedule#1.value_with_tax" in field_name_lower:
        if db:
            return get_amazon_us_baseline_price_str(db, model.id)
        # If db is somehow missing (shouldn't happen with updated callers), strict rules say NO FALLBACK.
        # But for now, if db is missing, we can't query.
        raise HTTPException(status_code=500, detail="Database session missing in export logic.")
    
    if 'contribution_sku' in field_name_lower and listing_type == 'individual':
        return model.parent_sku if model.parent_sku else None
    
    # Only include custom_value or selected_value if field is marked as required
    if field.required:
        if field.custom_value:
            return substitute_placeholders(field.custom_value, model, series, manufacturer, equipment_type, is_image_url=is_image_field)
        
        if field.selected_value:
            return field.selected_value
        
        # Auto-generate values for common fields only if required
        if 'item_name' in field_name_lower or 'product_name' in field_name_lower or 'title' in field_name_lower:
            mfr_name = manufacturer.name if manufacturer else ''
            series_name = series.name if series else ''
            return f"{mfr_name} {series_name} {model.name} Cover"
        
        if 'brand' in field_name_lower or 'brand_name' in field_name_lower:
            return manufacturer.name if manufacturer else None
        
        if 'model' in field_name_lower or 'model_number' in field_name_lower or 'model_name' in field_name_lower:
            return model.name
        
        if 'manufacturer' in field_name_lower:
            return manufacturer.name if manufacturer else None
    
    return None
