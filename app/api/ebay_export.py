"""app/api/ebay_export.py

PHASE 4 (new): eBay CSV Export MVP

CHUNK 1

Goal:
    Add a backend endpoint that exports selected models (and their persisted variation SKUs)
    as an eBay template-shaped CSV.

Scope (this chunk):
    - Add POST /api/ebay-export/export
    - Load the *current* eBay template field map from the database (EbayField rows)
    - Produce a CSV with:
        * Template columns (ordered)
        * One row per ModelVariationSKU for the selected model_ids
        * Minimal dynamic fields: Action, SKU, Title, Relationship

Non-goals (future chunks):
    - Relationship details axis computation
    - Placeholder substitution like [EBAY_REL_DETAILS_PARENT] / [EBAY_REL_DETAILS_CHILD]
    - Role-key persistence / migrations
    - Selection-driven axis payload from the UI
"""

from __future__ import annotations

import csv
import io
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import Model, ModelVariationSKU
from app.models.templates import EbayTemplate, EbayField


router = APIRouter(prefix="/ebay-export", tags=["eBay Export"])


class EbayExportRequest(BaseModel):
    model_ids: List[int]
    use_generated_variation_skus: bool = True


def _normalize_key(s: str) -> str:
    return (s or "").replace("\u00A0", " ").strip().lower()


def _load_current_template_columns(db: Session) -> List[EbayField]:
    """Load current (latest) template fields ordered deterministically."""
    latest = (
        db.query(EbayTemplate)
        .order_by(EbayTemplate.uploaded_at.desc(), EbayTemplate.id.desc())
        .first()
    )
    if not latest:
        raise HTTPException(status_code=404, detail="No eBay template uploaded")

    # Order by order_index ASC (nulls last), then id ASC
    fields: List[EbayField] = (
        db.query(EbayField)
        .filter(EbayField.ebay_template_id == latest.id)
        .order_by(func.coalesce(EbayField.order_index, 10**9), EbayField.id)
        .all()
    )
    if not fields:
        raise HTTPException(
            status_code=400,
            detail="Current eBay template has no parsed fields. Parse the template first.",
        )

    return fields


def _template_default_value(field: EbayField) -> str:
    """Return default value for a template column (custom_value wins, then selected_value)."""
    if field.custom_value is not None and str(field.custom_value).strip() != "":
        return str(field.custom_value)
    if field.selected_value is not None and str(field.selected_value).strip() != "":
        return str(field.selected_value)
    return ""


@router.post("/export")
def export_ebay_csv(request: EbayExportRequest, db: Session = Depends(get_db)):
    """Export selected models to an eBay CSV using the *current* parsed eBay template.

    CSV shape:
      - Columns come from EbayField.field_name (ordered by order_index)
      - Rows: one per persisted ModelVariationSKU (for selected model_ids)

    MVP dynamic fields:
      - *Action(...) -> "Add"
      - Custom label (SKU) -> variation sku
      - Title -> model.name
      - Relationship -> "Parent" | "Variation" (based on is_parent)

    NOTE: Relationship details is intentionally left blank in CHUNK 1.
    """

    if not request.model_ids:
        raise HTTPException(status_code=400, detail="No model_ids provided")

    # 1) Ensure models exist
    models: List[Model] = db.query(Model).filter(Model.id.in_(request.model_ids)).all()
    if len(models) != len(set(request.model_ids)):
        found = {m.id for m in models}
        missing = sorted(set(request.model_ids) - found)
        raise HTTPException(status_code=404, detail=f"Models not found: {missing}")

    model_by_id: Dict[int, Model] = {m.id: m for m in models}

    # 2) Load current template columns
    fields = _load_current_template_columns(db)
    headers = [f.field_name for f in fields]
    defaults_by_norm = {_normalize_key(f.field_name): _template_default_value(f) for f in fields}

    # 3) Load variation rows
    # IMPORTANT: For MVP we treat all persisted model_variation_skus as "eBay variations"
    # because they were generated from the eBay page.
    variations: List[ModelVariationSKU] = (
        db.query(ModelVariationSKU)
        .filter(ModelVariationSKU.model_id.in_(request.model_ids))
        .order_by(
            ModelVariationSKU.model_id.asc(),
            ModelVariationSKU.is_parent.desc(),
            ModelVariationSKU.sku.asc(),
        )
        .all()
    )
    if request.use_generated_variation_skus and not variations:
        raise HTTPException(
            status_code=400,
            detail="No variation SKUs found for selected models. Generate variations first.",
        )

    # 4) Build CSV in-memory
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(headers)

    # Column key normalization helpers
    KEY_ACTION = "*action"
    KEY_SKU = "custom label (sku)"
    KEY_TITLE = "title"
    KEY_REL = "relationship"
    KEY_REL_DETAILS = "relationship details"
    KEY_PRICE = "start price"
    KEY_QTY = "quantity"

    # Load all DesignOptions for lookup
    from app.models.core import DesignOption, MaterialColourSurcharge
    all_design_options = {
        d.id: d for d in db.query(DesignOption).all()
    }
    
    # Eager load color surcharges to avoid N+1
    # We already have variations list but the objects are detached or attached.
    # To be safe and efficient, we can re-query or just let lazy loading happen 
    # (since we are in a session), but let's pre-load colors used.
    # Actually, simplistic approach: lazy load is fine for < 1000 rows.
    
    # Helper to build specifics string
    def build_specifics(var: ModelVariationSKU, is_parent_row: bool, sibling_vars: List[ModelVariationSKU]) -> str:
        """
        Build 'Relationship details' string.
        Parent format: Key=Val1;Val2|Key2=ValA;ValB
        Child format: Key=Val1;Key2=ValA
        """
        # 1. Identify all keys and values for the entire group (siblings)
        # keys -> Set of values
        check_padding = any(v.with_padding != sibling_vars[0].with_padding for v in sibling_vars)
        # Always include Color
        
        # Collect data for all siblings
        data_map = {} # var_id -> { "Color": "...", "Padding": "...", "OptionType": "OptionName" }
        all_keys = set()
        
        for sv in sibling_vars:
            props = {}
            # Color
            if sv.material_colour_surcharge:
                c = sv.material_colour_surcharge
                c_name = c.color_friendly_name or c.colour
                props["Color"] = c_name
            
            # Padding (only if it varies across the group, usually implies distinct SKUs)
            # Actually eBay requires consistent variation usage. 
            # If ANY sibling has padding diffs, ALL must define the trait.
            # But here we are generating specific keys.
            # Let's verify if 'Padding' is a relevant axis.
            # If user generated some with and some without, it is relevant.
            # If all are 'No Padding', maybe we don't list it? 
            # BUT if we want to differentiate from potential future padded ones?
            # Safest: If group has mixed padding, include it.
            # Or always include it if defined?
            # Let's go with: Include if mixed OR if explicitly True.
            
            if sv.with_padding:
                props["Padding"] = "With Padding"
            elif any(s.with_padding for s in sibling_vars): # If others have it, we must define it (e.g. No Padding)
                 props["Padding"] = "No Padding"
            
            # Design Options
            if sv.design_option_ids:
                for do_id in sv.design_option_ids:
                    dopt = all_design_options.get(do_id)
                    if dopt:
                        key = dopt.option_type or "Option"
                        val = dopt.name
                        props[key] = val
                        
            data_map[sv.id] = props
            all_keys.update(props.keys())
            
        sorted_keys = sorted(list(all_keys))
        
        if is_parent_row:
            # Aggregate all possible values for each key
            segments = []
            for k in sorted_keys:
                values = set()
                for props in data_map.values():
                    if k in props:
                        values.add(props[k])
                
                # Check for explicit blank? eBay requires all variations to have the specific.
                # If some missed it, that's an issue.
                
                sorted_vals = sorted(list(values))
                if sorted_vals:
                    segments.append(f"{k}={';'.join(sorted_vals)}")
            return "|".join(segments)
        else:
            # Child row specifics
            props = data_map.get(var.id, {})
            segments = []
            for k in sorted_keys:
                if k in props:
                    segments.append(f"{k}={props[k]}")
            return ";".join(segments)

    # Group variations by model
    vars_by_model: Dict[int, List[ModelVariationSKU]] = {}
    for var in variations:
        if var.model_id not in vars_by_model:
            vars_by_model[var.model_id] = []
        vars_by_model[var.model_id].append(var)

    for var in variations:
        model = model_by_id.get(var.model_id)
        if not model:
            continue

        # Start with template defaults
        row_by_norm: Dict[str, str] = dict(defaults_by_norm)

        # Dynamic field overrides (MVP)
        # Action
        for k in list(row_by_norm.keys()):
            if k.startswith(KEY_ACTION):
                row_by_norm[k] = "Add"

        # SKU
        row_by_norm[KEY_SKU] = var.sku

        # Title
        row_by_norm[KEY_TITLE] = model.name or ""

        # Relationship
        is_parent = bool(var.is_parent)
        row_by_norm[KEY_REL] = "Parent" if is_parent else "Variation"

        # Relationship details
        siblings = vars_by_model.get(var.model_id, [])
        # We need to filter siblings to only 'Variation' rows (children) for the aggregation logic?
        # Typically Parent aggregates Children.
        # But here 'var' might be the Parent SKU itself?
        # Wait, ModelVariationSKU table has `is_parent`.
        # If var is parent, siblings should include itself? No, usually aggregates children.
        # My logic above `build_specifics` takes `sibling_vars`. 
        # For Parent row, we should pass ALL children.
        # For Child row, we pass ALL children (to determine keys) but output specific.
        
        children = [v for v in siblings if not v.is_parent]
        
        # If this row IS a child, it is one of 'children'.
        # If this row IS a parent, it is not in 'children'.
        # We use 'children' to determine the set of keys/values.
        
        rel_details = build_specifics(var, is_parent, children)
        row_by_norm[KEY_REL_DETAILS] = rel_details

        # Optional: pricing (skip for parent usually, but eBay allows range or fixed)
        if not is_parent and var.retail_price_cents is not None:
             row_by_norm[KEY_PRICE] = f"{var.retail_price_cents / 100:.2f}"
        
        # Quantity
        if not is_parent and not row_by_norm.get(KEY_QTY):
             row_by_norm[KEY_QTY] = "1"
        if is_parent:
             # Parent quantity is usually ignored or blank
             pass

        # Emit row in original header order
        row_out: List[str] = []
        for header in headers:
            row_out.append(row_by_norm.get(_normalize_key(header), ""))

        writer.writerow(row_out)

    csv_bytes = output.getvalue().encode("utf-8-sig")  # BOM matches typical eBay CSV exports
    output.close()

    filename = "ebay_export.csv"
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )
