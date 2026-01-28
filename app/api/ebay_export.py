"""
app/api/ebay_export.py

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
    - Role-key persistence / migrations
    - Selection-driven axis payload from the UI
"""

from __future__ import annotations

import csv
import io
import logging
import re
from typing import Dict, List, Optional, Set, Union, Tuple

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.core import (
    Model,
    ModelVariationSKU,
    MaterialRoleConfig,
    DesignOption,
    MaterialColourSurcharge,
    Material,
)
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
    with_padding: Union[str, bool, None] = "both"  # "both", "with_padding", "no_padding", True, False


def _normalize_key(s: str) -> str:
    # Normalize: strip, lower, handle non-breaking spaces, AND underscores->spaces
    return (s or "").replace("\u00A0", " ").replace("_", " ").strip().lower()


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


def _slice_to_version_prefix(base_sku: str) -> Optional[str]:
    """
    Take the model’s parent SKU, trim it to the version marker only (...V1, ...V2),
    dropping any trailing zeros or other characters after the numeric version.
    """
    if not base_sku:
        return None

    matches = list(re.finditer(r"V(\d+)", base_sku, flags=re.IGNORECASE))
    if not matches:
        return base_sku + "-"  # Fallback if no version marker, assume we append

    last_match = matches[-1]

    digits = last_match.group(1)
    # User rule: V10000000 -> V1. Strip trailing zeros.
    stripped = digits.rstrip("0")
    if not stripped:
        stripped = "0"

    # The prefix ends right before the 'V'
    prefix_body = base_sku[: last_match.start()]

    # Reconstruct version marker
    return f"{prefix_body}V{stripped}"


def _build_design_suffix(design_ids: List[int], all_opts: Dict[int, DesignOption]) -> str:
    """Build sort-safe design suffix: keys mapped to abbrevs, sorted alphanumeric, joined."""
    found = []
    for did in design_ids:
        opt = all_opts.get(did)
        if opt and opt.sku_abbreviation:
            found.append(opt.sku_abbreviation.strip().upper())

    found.sort()
    return "".join(found)


def _get_role_rank_from_abbrev(abbrev: str) -> int:
    """Strict explicit ranking: C=0, CG=1, L=2, LG=3."""
    mapping = {"C": 0, "CG": 1, "L": 2, "LG": 3}
    return mapping.get((abbrev or "").upper().strip(), 999)


def _get_color_sort_tuple_from_name(name: str) -> Tuple[int, str]:
    """Sort key for Color Friendly Name: PBK/Pitch-Black first, then alpha."""
    s = (name or "").strip()
    norm = s.replace(" ", "-").lower()
    if norm == "pitch-black":
        return (0, s)
    return (1, s)


@router.post("/export")
def export_ebay_csv(request: EbayExportRequest, db: Session = Depends(get_db)):
    """Export selected models to an eBay CSV using the *current* parsed eBay template."""
    export_mode_norm = (request.export_mode or "data_driven").strip().lower()
    if export_mode_norm not in ("selection_driven", "data_driven"):
        if "selection" in export_mode_norm:
            export_mode_norm = "selection_driven"
        else:
            export_mode_norm = "data_driven"

    allowed_padding_set: Set[bool] = {True, False}
    wp_raw = request.with_padding

    if isinstance(wp_raw, bool):
        allowed_padding_set = {wp_raw}
    elif isinstance(wp_raw, str):
        s = wp_raw.lower().strip()
        if s == "both":
            allowed_padding_set = {True, False}
        elif s in ("with_padding", "with", "true"):
            allowed_padding_set = {True}
        elif s in ("no_padding", "without", "false"):
            allowed_padding_set = {False}
        else:
            allowed_padding_set = {True, False}
    elif wp_raw is None:
        allowed_padding_set = {True, False}

    print(f"[EBAY-EXPORT-DEBUG] mode={export_mode_norm}, with_padding={allowed_padding_set}, raw={wp_raw}")

    if not request.model_ids:
        raise HTTPException(status_code=400, detail="No model_ids provided")

    models: List[Model] = db.query(Model).filter(Model.id.in_(request.model_ids)).all()
    if len(models) != len(set(request.model_ids)):
        found = {m.id for m in models}
        missing = sorted(set(request.model_ids) - found)
        raise HTTPException(status_code=404, detail=f"Models not found: {missing}")

    model_by_id: Dict[int, Model] = {m.id: m for m in models}

    fields = _load_current_template_columns(db)
    headers = [f.field_name for f in fields]
    defaults_by_norm = {_normalize_key(f.field_name): _template_default_value(f) for f in fields}

    role_configs = {_normalize_key(rc.role): rc for rc in db.query(MaterialRoleConfig).all()}
    all_design_options = {d.id: d for d in db.query(DesignOption).all()}

    variations: List[ModelVariationSKU] = (
        db.query(ModelVariationSKU)
        .filter(ModelVariationSKU.model_id.in_(request.model_ids))
        .all()
    )

    if export_mode_norm == "selection_driven":
        filtered_vars: List[ModelVariationSKU] = []
        target_colors = set(request.color_surcharge_ids)
        target_design_opts = set(request.design_option_ids)
        target_role_keys = set(request.role_keys) if request.role_keys else set()

        for var in variations:
            if var.is_parent:
                filtered_vars.append(var)
                continue

            if target_colors:
                if var.material_colour_surcharge_id not in target_colors:
                    continue

            var_opts = set(var.design_option_ids or [])
            if not var_opts.issubset(target_design_opts):
                continue

            is_padded = bool(var.with_padding)
            if is_padded not in allowed_padding_set:
                continue

            if target_role_keys:
                if not var.role_key or var.role_key not in target_role_keys:
                    continue

            filtered_vars.append(var)

        variations = filtered_vars

    # Group by model
    vars_by_model: Dict[int, List[ModelVariationSKU]] = {}
    for var in variations:
        vars_by_model.setdefault(var.model_id, []).append(var)

    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(headers)

    KEY_ACTION = "*action"
    KEY_SKU = "custom label (sku)"
    KEY_TITLE = "title"
    KEY_REL = "relationship"
    KEY_REL_DETAILS = "relationship details"
    KEY_PRICE = "start price"
    KEY_QTY = "quantity"

    def get_sku_attributes(sv: ModelVariationSKU, role_config: Optional[MaterialRoleConfig]) -> Dict[str, str]:
        vals: Dict[str, str] = {}

        fabric_label = "Unknown Fabric"
        if sv.role_key:
            fabric_label = sv.role_key
        elif role_config:
            fabric_label = role_config.role
        elif sv.material:
            fabric_label = sv.material.name

        vals["Fabric"] = f"{fabric_label} w/ Padding" if sv.with_padding else fabric_label

        c_name = "Unknown Color"
        if sv.material_colour_surcharge:
            c = sv.material_colour_surcharge
            c_name = c.color_friendly_name or c.colour
        vals["Color"] = c_name

        dopts = [all_design_options.get(did) for did in (sv.design_option_ids or [])]

        has_pocket = False
        has_zipper = False

        for d in dopts:
            if d:
                d_name = (d.name or "").lower()
                if "pocket" in d_name:
                    has_pocket = True
                if "zipper" in d_name and "handle" in d_name:
                    has_zipper = True

        vals["Pocket"] = "Yes Pocket" if has_pocket else "No Pocket"
        vals["Zipper Handle"] = "Yes Zipper Handle" if has_zipper else "No Zipper Handle"

        return vals

    active_model_ids = sorted(list(vars_by_model.keys()))

    for mid in active_model_ids:
        model = model_by_id[mid]
        model_vars = vars_by_model[mid]

        parent_sku = model.sku_override or model.parent_sku or f"MOD-{model.id}"
        version_prefix = _slice_to_version_prefix(parent_sku)

        export_children = []
        children = [v for v in model_vars if not v.is_parent]

        for var in children:
            norm_role = _normalize_key(var.role_key)
            rc = role_configs.get(norm_role)

            role_abbrev = ""
            if rc:
                role_abbrev = (rc.sku_abbrev_with_padding or "") if var.with_padding else (rc.sku_abbrev_no_padding or "")
            role_abbrev = (role_abbrev or "").strip().upper()

            if not role_abbrev:
                logger.warning(
                    f"Skipping variation {var.sku}: Missing role abbreviation for role '{var.role_key}' (padded={var.with_padding})"
                )
                continue

            color_abbrev = ""
            if var.material_colour_surcharge:
                color_abbrev = (var.material_colour_surcharge.sku_abbreviation or "").strip().upper()

            ids = [i for i in (var.design_option_ids or []) if i is not None]
            design_suffix = _build_design_suffix(ids, all_design_options)

            final_sku = f"{version_prefix}{role_abbrev}{color_abbrev}{design_suffix}"
            attrs = get_sku_attributes(var, rc)

            sort_role_rank = _get_role_rank_from_abbrev(role_abbrev)
            sort_padding = 1 if var.with_padding else 0

            # COLOR SORT INVARIANT (DO NOT CHANGE)
            # Ordering is STRICTLY defined as:
            #   1) Pitch-Black FIRST (sku_abbreviation == "PBK")
            #   2) All remaining colors sorted ALPHANUMERICALLY by sku_abbreviation
            #
            # IMPORTANT:
            # - NO business overrides (e.g. "Red before Brown") are allowed.
            # - Alphabetical order already guarantees FER < MBR < PBL, etc.
            # - SKU uses color *abbreviations* ONLY.
            # - Relationship Details use color *friendly names* ONLY.
            # - Color surcharge values MUST NOT influence SKU order or structure.
            #
            # This rule is contractual and relied upon by downstream marketplaces.
            # Any deviation WILL break SKU determinism and variation grouping.
            is_pbk = (color_abbrev == "PBK")
            sort_color = (0, color_abbrev) if is_pbk else (1, color_abbrev)

            sort_opts_len = len(design_suffix)
            sort_opts_alpha = design_suffix

            sort_key = (sort_role_rank, sort_padding, sort_color, sort_opts_len, sort_opts_alpha)

            export_children.append(
                {"sku": final_sku, "var": var, "attrs": attrs, "sort_key": sort_key}
            )

        export_children.sort(key=lambda x: x["sort_key"])
        if not export_children:
            continue

        valid_axes = ["Fabric", "Color", "Pocket", "Zipper Handle"]

        axis_values_map = {axis: set() for axis in valid_axes}
        for item in export_children:
            for k, v in item["attrs"].items():
                if k in axis_values_map:
                    axis_values_map[k].add(v)

        try:
            row_by_norm = dict(defaults_by_norm)
            row_by_norm[KEY_ACTION] = "Add"
            row_by_norm[KEY_SKU] = parent_sku
            row_by_norm[KEY_TITLE] = model.name or ""
            row_by_norm[KEY_REL] = "Parent"

            rel_segments = []
            for axis in valid_axes:
                raw_vals = list(axis_values_map[axis])

                if axis == "Color":
                    raw_vals.sort(key=_get_color_sort_tuple_from_name)
                elif axis == "Pocket":
                    raw_vals.sort(key=lambda v: 0 if "No" in v else 1)
                elif axis == "Zipper Handle":
                    raw_vals.sort(key=lambda v: 0 if "No" in v else 1)
                elif axis == "Fabric":
                    def _fabric_sort_key(s: str):
                        is_pad = " w/ Padding" in s
                        core_key = s.replace(" w/ Padding", "").strip()
                        norm_key = _normalize_key(core_key)
                        rc2 = role_configs.get(norm_key)
                        rank = 999
                        if rc2:
                            ab = rc2.sku_abbrev_with_padding if is_pad else rc2.sku_abbrev_no_padding
                            if ab:
                                rank = _get_role_rank_from_abbrev(ab)
                        return (rank, 1 if is_pad else 0, s)

                    raw_vals.sort(key=_fabric_sort_key)
                else:
                    raw_vals.sort()

                if raw_vals:
                    rel_segments.append(f"{axis}={';'.join(raw_vals)}")

            row_by_norm[KEY_REL_DETAILS] = "|".join(rel_segments)

            row_out = [row_by_norm.get(_normalize_key(h), "") for h in headers]
            writer.writerow(row_out)

        except Exception as e:
            logger.error(f"Error writing parent {parent_sku}: {e}")
            raise

        for item in export_children:
            try:
                var = item["var"]
                sku = item["sku"]
                attrs = item["attrs"]

                row_by_norm = dict(defaults_by_norm)
                row_by_norm[KEY_ACTION] = "Add"
                row_by_norm[KEY_SKU] = sku
                row_by_norm[KEY_TITLE] = model.name or ""
                row_by_norm[KEY_REL] = "Variation"

                rel_segments = []
                for axis in valid_axes:
                    val = attrs.get(axis)
                    if val:
                        rel_segments.append(f"{axis}={val}")
                row_by_norm[KEY_REL_DETAILS] = "|".join(rel_segments)

                if var.retail_price_cents is not None:
                    row_by_norm[KEY_PRICE] = f"{var.retail_price_cents / 100:.2f}"
                if not row_by_norm.get(KEY_QTY):
                    row_by_norm[KEY_QTY] = "1"

                row_out = [row_by_norm.get(_normalize_key(h), "") for h in headers]
                writer.writerow(row_out)

            except Exception as e:
                logger.error(f"Error writing child {sku}: {e}")
                raise

    csv_bytes = output.getvalue().encode("utf-8-sig")
    output.close()

    filename = "ebay_export.csv"
    return StreamingResponse(
        io.BytesIO(csv_bytes),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
