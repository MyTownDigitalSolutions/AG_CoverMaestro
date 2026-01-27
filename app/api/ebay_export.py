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
import logging
from typing import Dict, List, Optional, Set, Union

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import Model, ModelVariationSKU, MaterialRoleConfig, DesignOption, MaterialColourSurcharge
from app.models.templates import EbayTemplate, EbayField


router = APIRouter(prefix="/ebay-export", tags=["eBay Export"])
logger = logging.getLogger(__name__)


class EbayExportRequest(BaseModel):
    model_ids: List[int]
    use_generated_variation_skus: bool = True
    
    # Selection-driven fields (eBay only)
    export_mode: Union[str, None] = "data_driven"  # "data_driven" or "selection_driven"
    
    # Selection criteria (optional filters)
    role_keys: List[str] = []
    color_surcharge_ids: List[int] = []
    design_option_ids: List[int] = []
    # FIX for Phase 4 Chunk 6-B: explicitly allow str/bool/None for with_padding
    with_padding: Union[str, bool, None] = "both" # "both", "with_padding", "no_padding", True, False


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

    # --- Schema Normalization ---
    # Normalize export_mode
    export_mode_norm = (request.export_mode or "data_driven").strip().lower()
    # Canonicalize
    if export_mode_norm not in ("selection_driven", "data_driven"):
        if "selection" in export_mode_norm:
            export_mode_norm = "selection_driven"
        else:
            export_mode_norm = "data_driven"

    # Normalize with_padding
    # Target: set of allowed booleans {True, False} or subset
    allowed_padding_set: Set[bool] = {True, False}
    
    wp_raw = request.with_padding
    
    # Handle boolean inputs
    if isinstance(wp_raw, bool):
        allowed_padding_set = {wp_raw}
    
    # Handle string inputs
    elif isinstance(wp_raw, str):
        s = wp_raw.lower().strip()
        if s == "both":
            allowed_padding_set = {True, False}
        elif s == "with_padding" or s == "with" or s == "true":
            allowed_padding_set = {True}
        elif s == "no_padding" or s == "without" or s == "false":
            allowed_padding_set = {False}
        # Fallback to defaults (both) if unknown string
        else:
            allowed_padding_set = {True, False}
            
    # Handle None
    elif wp_raw is None:
         allowed_padding_set = {True, False}

    # Debug Log (Required)
    print(f"[EBAY-EXPORT-DEBUG] mode={export_mode_norm}, with_padding={allowed_padding_set}, raw={wp_raw}")

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

    # Load Role Configs for display mapping (eBay Only)
    role_configs = {
        _normalize_key(rc.role): rc 
        for rc in db.query(MaterialRoleConfig).all()
    }

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
    
    # --- Selection-Driven Filtering (eBay Only) ---
    if export_mode_norm == "selection_driven":
        filtered_vars: List[ModelVariationSKU] = []
        
        # Parse filter criteria
        target_colors = set(request.color_surcharge_ids)
        target_design_opts = set(request.design_option_ids)
        target_role_keys = set(request.role_keys) if request.role_keys else set()
        
        for var in variations:
            # Always include Parents first (we'll ensure 1 parent per model later)
            if var.is_parent:
                # We retain parent rows initially, but might replace/filter them based on children.
                # Actually, simplest approach: Filter children strictly. 
                # Then ensure a parent exists for any models that have remaining children.
                filtered_vars.append(var)
                continue
                
            # Filter Children
            
            # 1. Color Surcharge
            if target_colors:
                if var.material_colour_surcharge_id not in target_colors:
                    continue
            
            # 2. Design Options
            var_opts = set(var.design_option_ids or [])
            if not var_opts.issubset(target_design_opts):
                continue
            
            # 3. Padding
            is_padded = bool(var.with_padding)
            if is_padded not in allowed_padding_set:
                continue

            # 4. Role Key Filtering
            if target_role_keys:
                if not var.role_key or var.role_key not in target_role_keys:
                    continue
                
            filtered_vars.append(var)
            
        variations = filtered_vars

    if request.use_generated_variation_skus and not variations:
        # It's possible we filtered everything out.
        # But if we have valid input, we should return empty CSV or default error?
        # Let's return error consistent with original behavior if truly empty.
        pass # Fall through to below check or check len

    if not variations:
         raise HTTPException(
            status_code=400,
            detail="No variation SKUs found for selected criteria. Check filters or generate variations.",
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
        Build 'Relationship details' string with fixed axes: Fabric | Color | Pocket | Zipper Handle using deterministic logic.
        """
        AXIS_FABRIC = "Fabric"
        AXIS_COLOR = "Color"
        AXIS_POCKET = "Pocket"
        AXIS_ZIPPER = "Zipper Handle"
        
        # Order is significant
        ALL_AXES = [AXIS_FABRIC, AXIS_COLOR, AXIS_POCKET, AXIS_ZIPPER]
        
        # 1. Determine which axes are "Active" for this group
        # An axis is active if:
        # - It is Fabric or Color (Always active)
        # - It is Pocket or Zipper, AND at least one sibling has the "Yes" state (meaning the option is selected).
        #   If NO sibling has the option, we assume the model doesn't offer it, so we suppress the axis.
        #   (Or should we always show "No ..."? Prompt implies "2 children: Pocket=No Pocket;Yes Pocket" means it's active.)
        
        # Scan all siblings to determine feature presence
        has_pocket_option = False
        has_zipper_option = False
        
        for sv in sibling_vars:
            dopts = [all_design_options.get(did) for did in (sv.design_option_ids or [])]
            for d in dopts:
                if d:
                    d_name = (d.name or "").lower()
                    if "2-in-1 pocket" in d_name or "pocket" in d_name: # "2-in-1 Pocket" is specific target
                        has_pocket_option = True
                    if "zipperized top amp handle" in d_name:
                        has_zipper_option = True
        
        active_axes = [AXIS_FABRIC, AXIS_COLOR]
        if has_pocket_option:
            active_axes.append(AXIS_POCKET)
        if has_zipper_option:
            active_axes.append(AXIS_ZIPPER)
            
        # Helper to compute values for a single SKU
        def get_sku_values(sv: ModelVariationSKU) -> Dict[str, str]:
            vals = {}
            
            # --- Fabric ---
            # Priority: Role Key -> Role Config Display Name
            # Fallback: Material Name (legacy)
            fabric_label = "Unknown Fabric"
            
            if sv.role_key:
                norm_role = _normalize_key(sv.role_key)
                rc = role_configs.get(norm_role)
                if rc:
                   fabric_label = rc.display_name or rc.role
                else: 
                   fabric_label = sv.role_key # Fallback if config missing
            elif sv.material:
                fabric_label = sv.material.name
                
            if sv.with_padding:
                vals[AXIS_FABRIC] = f"{fabric_label} w/ Padding"
            else:
                 vals[AXIS_FABRIC] = fabric_label

            # --- Color ---
            c_name = "Unknown Color"
            if sv.material_colour_surcharge:
                c = sv.material_colour_surcharge
                c_name = c.color_friendly_name or c.colour
            vals[AXIS_COLOR] = c_name
            
            # --- Pocket ---
            if AXIS_POCKET in active_axes:
                has_pocket = False
                dopts = [all_design_options.get(did) for did in (sv.design_option_ids or [])]
                for d in dopts:
                    if d and "2-in-1 pocket" in (d.name or "").lower():
                        has_pocket = True
                        break
                vals[AXIS_POCKET] = "Yes Pocket" if has_pocket else "No Pocket"

            # --- Zipper Handle ---
            if AXIS_ZIPPER in active_axes:
                has_zipper = False
                dopts = [all_design_options.get(did) for did in (sv.design_option_ids or [])]
                for d in dopts:
                    if d and "zipperized top amp handle" in (d.name or "").lower():
                        has_zipper = True
                        break
                vals[AXIS_ZIPPER] = "Yes Zipper Handle" if has_zipper else "No Zipper Handle"
                
            return vals

        if is_parent_row:
            # Aggregate unique values for each axis from all siblings
            axis_values_map = {axis: set() for axis in active_axes}
            
            for sv in sibling_vars:
                sv_vals = get_sku_values(sv)
                for axis, val in sv_vals.items():
                    if axis in axis_values_map:
                        axis_values_map[axis].add(val)
            
            # Formatted strings
            segments = []
            for axis in active_axes:
                values = sorted(list(axis_values_map[axis]))
                if values:
                    segments.append(f"{axis}={';'.join(values)}")
            return "|".join(segments)
            
        else:
            # Child Row
            sv_vals = get_sku_values(var)
            segments = []
            for axis in active_axes:
                val = sv_vals.get(axis)
                if val:
                    segments.append(f"{axis}={val}")
            return "|".join(segments)

    # Group variations by model
    vars_by_model: Dict[int, List[ModelVariationSKU]] = {}
    for var in variations:
        if var.model_id not in vars_by_model:
            vars_by_model[var.model_id] = []
        vars_by_model[var.model_id].append(var)

    # OUTPUT GENERATION LOOP
    # We iterate by MODEL first to ensure structure: Parent -> Children
    
    # Identify all active models in the filtered variations
    active_model_ids = sorted(list(vars_by_model.keys()))
    
    for mid in active_model_ids:
        model = model_by_id[mid]
        model_vars = vars_by_model[mid]
        
        # 1. Identify/Create Unique Parent
        # Is there an existing parent row in filtered set?
        existing_parents = [v for v in model_vars if v.is_parent]
        
        children = [v for v in model_vars if not v.is_parent]
        
        if not children and not existing_parents:
            continue # Should not happen given outer filter
            
        # Select the Primary Parent to use
        # If multiple existing parents (shouldn't happen per model ideally), use first.
        # If no existing parent, SYNTHESIZE one.
        
        if existing_parents:
            parent_var = existing_parents[0]
        else:
            # Synthetic Parent
            # We need a SKU. Usually Model SKU + "-P" or similar?
            # Existing logic uses `model.sku + ...`?
            # Let's derive a logical parent SKU from the model itself or first child.
            # Best practice: Use model.sku if clean, or append suffix.
            # If no parent row exists in DB, we risk inventing a SKU that doesn't match persistent state.
            # Model.sku does not exist. Use parent_sku or derive from ID/Name.
            base_sku = model.parent_sku or f"MOD-{model.id}"
            parent_sku = f"{base_sku}-P"
            # Create a transient object
            parent_var = ModelVariationSKU(
                id=-1, # Dummy ID
                model_id=mid,
                sku=parent_sku,
                is_parent=True,
                retail_price_cents=None,
                # material_id is required by schema but we are transient. 
                # SQLAlchemy init doesn't enforce unless we flush.
                # However, code might access .material relationship. 
                # If we don't set .material, it is None.
                material_id=None, 
                material_colour_surcharge_id=None,
                design_option_ids=[],
                with_padding=False,
            )
            
        # Define export list for this model
        # [Parent, Child1, Child2, ...]
        export_list = [parent_var] + sorted(children, key=lambda v: v.sku)
        
        for var in export_list:
            try:
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
                # Pass ALL active children to parent logic to aggregate correctly.
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
            except Exception as e:
                logger.error(f"Error processing var {var.sku if hasattr(var, 'sku') else 'UNKNOWN'}: {e}", exc_info=True)
                raise e

    csv_bytes = output.getvalue().encode("utf-8-sig")  # BOM matches typical eBay CSV exports
    output.close()

    filename = "ebay_export.csv"
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""},
    )
