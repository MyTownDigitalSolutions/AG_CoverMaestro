from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from typing import Optional, List

from app.database import get_db
from app.services.ebay_template_service import EbayTemplateService
from app.schemas.templates import (
    EbayTemplateResponse,
    EbayTemplateParseSummary,
    EbayTemplateFieldsResponse,
    EbayFieldResponse
)
from app.models.templates import EbayTemplate, EbayField

router = APIRouter(
    prefix="/ebay-templates",
    tags=["Ebay Templates"]
)


def _build_ebay_template_fields_response(template_id: int, db: Session) -> EbayTemplateFieldsResponse:
    """
    Internal helper: Load fields + valid values for a template and map to API response models.
    Uses selectinload to reliably populate one-to-many relationships without join edge-cases.
    """
    # 1) Verify template exists
    template = db.query(EbayTemplate).filter(EbayTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # 2) Query fields and eagerly load valid_values via SELECT IN (more reliable than joinedload)
    # Order by order_index ASC (nulls last), then id ASC
    fields: List[EbayField] = (
        db.query(EbayField)
        .options(selectinload(EbayField.valid_values))
        .filter(EbayField.ebay_template_id == template_id)
        .order_by(func.coalesce(EbayField.order_index, 10**9), EbayField.id)
        .all()
    )

    # 3) Map to response
    response_fields: List[EbayFieldResponse] = []
    for f in fields:
        # Sort values deterministically by ID ASC
        sorted_values = sorted((f.valid_values or []), key=lambda v: v.id)

        # Map to List[str] as required by schema field 'allowed_values'
        allowed_strs = [v.value for v in sorted_values]

        response_fields.append(
            EbayFieldResponse(
                id=f.id,
                ebay_template_id=f.ebay_template_id,
                field_name=f.field_name,
                display_name=f.display_name,
                required=f.required,
                order_index=f.order_index,
                selected_value=f.selected_value,
                custom_value=f.custom_value,
                allowed_values=allowed_strs
            )
        )

    return EbayTemplateFieldsResponse(
        template_id=template_id,
        fields=response_fields
    )


@router.post("/upload", response_model=EbayTemplateResponse)
async def upload_ebay_template(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload and store the canonical eBay XLSX template (bit-for-bit).
    """
    service = EbayTemplateService(db)
    return await service.store_ebay_template_upload(file)


@router.get("/current", response_model=Optional[EbayTemplateResponse])
def get_current_ebay_template(db: Session = Depends(get_db)):
    """
    Get the most recently uploaded eBay template metadata.
    """
    latest = (
        db.query(EbayTemplate)
        .order_by(EbayTemplate.uploaded_at.desc(), EbayTemplate.id.desc())
        .first()
    )

    if not latest:
        return None

    return latest


@router.post("/{template_id}/parse", response_model=EbayTemplateParseSummary)
def parse_ebay_template(
    template_id: int,
    db: Session = Depends(get_db)
):
    """
    Parse the eBay template file and populate metadata in the database.
    Idempotent operation (clears existing fields/values for this template).
    """
    service = EbayTemplateService(db)
    return service.parse_ebay_template(template_id)


@router.get("/current/fields", response_model=EbayTemplateFieldsResponse)
def get_current_ebay_template_fields(db: Session = Depends(get_db)):
    """
    Get the parsed fields and allowed values for the MOST RECENT template.
    """
    latest = (
        db.query(EbayTemplate)
        .order_by(EbayTemplate.uploaded_at.desc(), EbayTemplate.id.desc())
        .first()
    )

    if not latest:
        raise HTTPException(status_code=404, detail="No eBay template uploaded")

    return _build_ebay_template_fields_response(latest.id, db)


@router.get("/{template_id}/fields", response_model=EbayTemplateFieldsResponse)
def get_ebay_template_fields(template_id: int, db: Session = Depends(get_db)):
    """
    Get the parsed fields and allowed values for a specific template.
    Returns fields ordered by order_index.
    """
    return _build_ebay_template_fields_response(template_id, db)
