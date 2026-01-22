from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from typing import Optional, List
import os
import hashlib
import csv
from datetime import datetime

from app.database import get_db
# We might need a service class later, but for now implementing logic here or reuse ebay service concepts
from app.schemas.templates import (
    ReverbTemplateResponse,
    ReverbTemplateParseSummary,
    ReverbTemplateFieldsResponse,
    ReverbFieldResponse,
    ReverbFieldUpdateRequest,
    ReverbValidValueCreateRequest,
    ReverbTemplatePreviewResponse,
    ReverbFieldOverrideResponse,
    ReverbFieldOverrideCreateRequest
    # ReverbTemplateIntegrityResponse, # Not defined yet, skipping for now
    # ReverbTemplateVerificationResponse # Not defined yet, skipping for now
)
from app.models.templates import ReverbTemplate, ReverbField, ReverbFieldValue, ReverbEquipmentTypeFieldOverride

router = APIRouter(
    prefix="/reverb-templates",
    tags=["Reverb Templates"]
)

STORE_DIR = "storage/reverb_templates"
os.makedirs(STORE_DIR, exist_ok=True)

def _build_reverb_template_fields_response(template_id: int, db: Session) -> ReverbTemplateFieldsResponse:
    """
    Internal helper: Load fields + valid values for a template and map to API response models.
    """
    # 1) Verify template exists
    template = db.query(ReverbTemplate).filter(ReverbTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # 2) Query fields and eagerly load valid_values
    fields: List[ReverbField] = (
        db.query(ReverbField)
        .options(
            selectinload(ReverbField.valid_values),
            selectinload(ReverbField.overrides)
        )
        .filter(ReverbField.reverb_template_id == template_id)
        .order_by(func.coalesce(ReverbField.order_index, 10**9), ReverbField.id)
        .all()
    )

    # 3) Map to response
    response_fields: List[ReverbFieldResponse] = []
    for f in fields:
        sorted_values = sorted((f.valid_values or []), key=lambda v: v.id)
        
        allowed_strs = [v.value for v in sorted_values]
        allowed_detailed = [{"id": v.id, "value": v.value} for v in sorted_values]

        # Map Overrides
        # We need to manually construct the Pydantic model for overrides because of forward ref?
        # Or just pass the ORM objects if the schema is correct.
        overrides_list = f.overrides or []

        response_fields.append(
            ReverbFieldResponse(
                id=f.id,
                reverb_template_id=f.reverb_template_id,
                field_name=f.field_name,
                display_name=f.display_name,
                required=f.required,
                order_index=f.order_index,
                selected_value=f.selected_value,
                custom_value=f.custom_value,
                allowed_values=allowed_strs,
                allowed_values_detailed=allowed_detailed,
                overrides=overrides_list
            )
        )

    return ReverbTemplateFieldsResponse(
        template_id=template_id,
        fields=response_fields
    )


@router.post("/upload", response_model=ReverbTemplateResponse)
async def upload_reverb_template(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload and store the Reverb CSV template.
    """
    # Create unique filename
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    clean_name = os.path.basename(file.filename)
    stored_filename = f"{timestamp}_{clean_name}"
    file_path = os.path.join(STORE_DIR, stored_filename)

    # Save file and calculate hash/size
    sha256_hash = hashlib.sha256()
    file_size = 0
    
    with open(file_path, "wb") as f:
        while chunk := await file.read(8192):
            f.write(chunk)
            sha256_hash.update(chunk)
            file_size += len(chunk)
    
    file_hash = sha256_hash.hexdigest()

    # Create DB record
    template = ReverbTemplate(
        original_filename=clean_name,
        file_path=file_path,
        file_size=file_size,
        sha256=file_hash,
        uploaded_at=datetime.utcnow()
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    
    return template


@router.get("/current", response_model=Optional[ReverbTemplateResponse])
def get_current_reverb_template(db: Session = Depends(get_db)):
    """
    Get the most recently uploaded Reverb template metadata.
    """
    latest = (
        db.query(ReverbTemplate)
        .order_by(ReverbTemplate.uploaded_at.desc(), ReverbTemplate.id.desc())
        .first()
    )
    return latest


@router.get("/", response_model=List[ReverbTemplateResponse])
def list_reverb_templates(db: Session = Depends(get_db)):
    """
    List all uploaded Reverb templates.
    """
    return db.query(ReverbTemplate).order_by(ReverbTemplate.uploaded_at.desc()).all()


@router.get("/{template_id}", response_model=ReverbTemplateResponse)
def get_reverb_template(template_id: int, db: Session = Depends(get_db)):
    """
    Get a specific Reverb template by ID.
    """
    template = db.query(ReverbTemplate).filter(ReverbTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("/{template_id}/parse", response_model=ReverbTemplateParseSummary)
def parse_reverb_template(
    template_id: int,
    db: Session = Depends(get_db)
):
    """
    Parse the Reverb CSV template and populate metadata in the database.
    """
    template = db.query(ReverbTemplate).filter(ReverbTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if not os.path.exists(template.file_path):
        raise HTTPException(status_code=400, detail="Template file not found")

    # Clear existing fields
    db.query(ReverbField).filter(ReverbField.reverb_template_id == template_id).delete()
    db.commit()

    fields_inserted = 0
    try:
        with open(template.file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            
            if headers:
                for idx, header in enumerate(headers):
                    if not header.strip():
                        continue
                        
                    # Basic field creation
                    field = ReverbField(
                        reverb_template_id=template_id,
                        field_name=header.strip(),
                        display_name=header.strip().replace('_', ' ').title(),
                        required=False, # Defaults to false, user must configure
                        order_index=idx
                    )
                    
                    # Auto-detect required fields based on known Reverb API requirements
                    lower_name = header.strip().lower()
                    if lower_name in ['make', 'model', 'price', 'condition', 'categories']:
                        field.required = True
                        
                    db.add(field)
                    fields_inserted += 1
                
                db.commit()
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse CSV: {str(e)}")

    return ReverbTemplateParseSummary(
        template_id=template_id,
        fields_inserted=fields_inserted,
        values_inserted=0, # No valid values extraction from CSV structure yet
        defaults_applied=0,
        values_ignored_not_in_template=0,
        defaults_ignored_not_in_template=0
    )


@router.get("/current/fields", response_model=ReverbTemplateFieldsResponse)
def get_current_reverb_template_fields(db: Session = Depends(get_db)):
    """
    Get the parsed fields for the MOST RECENT template.
    """
    latest = (
        db.query(ReverbTemplate)
        .order_by(ReverbTemplate.uploaded_at.desc(), ReverbTemplate.id.desc())
        .first()
    )

    if not latest:
        raise HTTPException(status_code=404, detail="No Reverb template uploaded")

    return _build_reverb_template_fields_response(latest.id, db)


@router.get("/{template_id}/fields", response_model=ReverbTemplateFieldsResponse)
def get_reverb_template_fields(template_id: int, db: Session = Depends(get_db)):
    return _build_reverb_template_fields_response(template_id, db)


@router.patch("/fields/{field_id}", response_model=ReverbFieldResponse)
def update_reverb_field(
    field_id: int,
    updates: ReverbFieldUpdateRequest,
    db: Session = Depends(get_db)
):
    field = (
        db.query(ReverbField)
        .options(
            selectinload(ReverbField.valid_values),
            selectinload(ReverbField.overrides)
        )
        .filter(ReverbField.id == field_id)
        .first()
    )
    
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    
    if updates.required is not None:
        field.required = updates.required
    
    if updates.selected_value is not None:
        if updates.selected_value == "Any" or updates.selected_value == "":
            field.selected_value = None
        else:
            valid_values_list = [v.value for v in field.valid_values]
            if updates.selected_value in valid_values_list or updates.custom_value is not None:
                field.selected_value = updates.selected_value
            else:
                # If custom value is set, we strictly shouldn't fail, but let's be safe
                pass
                
    if updates.custom_value is not None:
        field.custom_value = updates.custom_value if updates.custom_value else None
    
    db.commit()
    db.refresh(field)
    
    # Return updated field
    sorted_values = sorted((field.valid_values or []), key=lambda v: v.id)
    allowed_strs = [v.value for v in sorted_values]
    allowed_detailed = [{"id": v.id, "value": v.value} for v in sorted_values]
    
    return ReverbFieldResponse(
        id=field.id,
        reverb_template_id=field.reverb_template_id,
        field_name=field.field_name,
        display_name=field.display_name,
        required=field.required,
        order_index=field.order_index,
        selected_value=field.selected_value,
        custom_value=field.custom_value,
        allowed_values=allowed_strs,
        allowed_values_detailed=allowed_detailed,
        overrides=field.overrides or []
    )


@router.post("/fields/{field_id}/valid-values", response_model=ReverbFieldResponse)
def add_valid_value_to_reverb_field(
    field_id: int,
    request: ReverbValidValueCreateRequest,
    db: Session = Depends(get_db)
):
    value = request.value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Value cannot be empty")
    
    field = db.query(ReverbField).filter(ReverbField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    
    existing = db.query(ReverbFieldValue).filter(
        ReverbFieldValue.reverb_field_id == field_id,
        ReverbFieldValue.value == value
    ).first()
    
    if not existing:
        new_value = ReverbFieldValue(reverb_field_id=field_id, value=value)
        db.add(new_value)
        db.commit()
        db.refresh(field)
    
    # Re-fetch for response
    return update_reverb_field(field_id, ReverbFieldUpdateRequest(), db)


@router.delete("/fields/{field_id}/valid-values/{value_id}", response_model=ReverbFieldResponse)
def delete_valid_value_from_reverb_field(
    field_id: int,
    value_id: int,
    db: Session = Depends(get_db)
):
    value_obj = db.query(ReverbFieldValue).filter(
        ReverbFieldValue.id == value_id,
        ReverbFieldValue.reverb_field_id == field_id
    ).first()
    
    if not value_obj:
        raise HTTPException(status_code=404, detail="Value not found")
    
    field = db.query(ReverbField).filter(ReverbField.id == field_id).first()
    if field.selected_value == value_obj.value:
        field.selected_value = None
    
    db.delete(value_obj)
    db.commit()
    
    return update_reverb_field(field_id, ReverbFieldUpdateRequest(), db)


@router.post("/fields/{field_id}/overrides", response_model=ReverbFieldResponse)
def create_reverb_field_override(
    field_id: int,
    request: ReverbFieldOverrideCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Create or update an override for a specific field and equipment type.
    """
    field = db.query(ReverbField).filter(ReverbField.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    # Check if override exists
    existing = db.query(ReverbEquipmentTypeFieldOverride).filter(
        ReverbEquipmentTypeFieldOverride.reverb_field_id == field_id,
        ReverbEquipmentTypeFieldOverride.equipment_type_id == request.equipment_type_id
    ).first()

    if existing:
        existing.default_value = request.default_value
    else:
        new_override = ReverbEquipmentTypeFieldOverride(
            reverb_field_id=field_id,
            equipment_type_id=request.equipment_type_id,
            default_value=request.default_value
        )
        db.add(new_override)
    
    db.commit()
    db.refresh(field)
    
    # Return updated field
    # We reuse the update logic? No, just call the helper or update_reverb_field
    return update_reverb_field(field_id, ReverbFieldUpdateRequest(), db)


@router.delete("/fields/{field_id}/overrides/{override_id}", response_model=ReverbFieldResponse)
def delete_reverb_field_override(
    field_id: int,
    override_id: int,
    db: Session = Depends(get_db)
):
    override = db.query(ReverbEquipmentTypeFieldOverride).filter(
        ReverbEquipmentTypeFieldOverride.id == override_id,
        ReverbEquipmentTypeFieldOverride.reverb_field_id == field_id
    ).first()
    
    if not override:
        raise HTTPException(status_code=404, detail="Override not found")
        
    db.delete(override)
    db.commit()
    
    return update_reverb_field(field_id, ReverbFieldUpdateRequest(), db)


@router.get("/current/download")
def download_current_reverb_template(mode: str = "inline", db: Session = Depends(get_db)):
    latest = (
        db.query(ReverbTemplate)
        .order_by(ReverbTemplate.uploaded_at.desc(), ReverbTemplate.id.desc())
        .first()
    )
    
    if not latest or not os.path.exists(latest.file_path):
        raise HTTPException(status_code=404, detail="Template not found")
        
    disposition = "inline" if mode == "inline" else "attachment"
    
    response = FileResponse(
        path=latest.file_path,
        filename=latest.original_filename,
        media_type="text/csv"
    )
    response.headers["Content-Disposition"] = f'{disposition}; filename="{latest.original_filename}"'
    return response


@router.get("/current/preview", response_model=ReverbTemplatePreviewResponse)
def preview_current_reverb_template(
    preview_rows: int = 25,
    preview_cols: int = 20,
    db: Session = Depends(get_db)
):
    latest = (
        db.query(ReverbTemplate)
        .order_by(ReverbTemplate.uploaded_at.desc(), ReverbTemplate.id.desc())
        .first()
    )
    
    if not latest or not os.path.exists(latest.file_path):
        raise HTTPException(status_code=404, detail="Template not found")

    grid = []
    max_col = 0
    try:
        with open(latest.file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            for i, row in enumerate(reader):
                if i >= preview_rows:
                    break
                grid.append(row[:preview_cols])
                max_col = max(max_col, len(row))
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return ReverbTemplatePreviewResponse(
        template_id=latest.id,
        original_filename=latest.original_filename,
        sheet_name="csv",
        max_row=len(grid), # Approximation
        max_column=max_col,
        preview_row_count=len(grid),
        preview_column_count=max_col,
        grid=grid
    )
