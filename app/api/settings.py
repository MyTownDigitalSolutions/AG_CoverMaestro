from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from datetime import datetime, timedelta
import traceback

from app.database import get_db
from app.models.enums import Carrier
from app.models.core import (
    MaterialRoleAssignment, Material,
    ShippingRateCard, ShippingRateTier, ShippingZoneRate, MarketplaceShippingProfile,
    LaborSetting, MarketplaceFeeRate, VariantProfitSetting, ShippingZone, ShippingDefaultSetting
)
from app.schemas.core import (
    MaterialRoleAssignmentCreate, MaterialRoleAssignmentResponse,
    ShippingRateCardCreate, ShippingRateCardResponse, ShippingRateCardUpdate,
    ShippingRateTierCreate, ShippingRateTierResponse, ShippingRateTierUpdate, TierCreateRequest,
    ShippingZoneRateCreate, ShippingZoneRateResponse,  # existing
    MarketplaceShippingProfileCreate, MarketplaceShippingProfileResponse,
    LaborSettingCreate, LaborSettingResponse,
    MarketplaceFeeRateCreate, MarketplaceFeeRateResponse,
    VariantProfitSettingCreate, VariantProfitSettingResponse,
    ShippingZoneResponse,
    ShippingZoneRateNormalizedResponse, ShippingZoneRateUpsertRequest,
    ShippingDefaultSettingCreate, ShippingDefaultSettingResponse
)

router = APIRouter(prefix="/settings", tags=["settings"])


# ------------------------------------------------------------------
# 1. Material Roles
# ------------------------------------------------------------------

@router.get("/material-roles", response_model=List[MaterialRoleAssignmentResponse])
def get_material_role_assignments(include_history: bool = False, db: Session = Depends(get_db)):
    query = db.query(MaterialRoleAssignment)
    if not include_history:
        # Return only currently active
        now = datetime.utcnow()
        query = query.filter(
            MaterialRoleAssignment.effective_date <= now,
            (MaterialRoleAssignment.end_date == None) | (MaterialRoleAssignment.end_date > now)
        )
    return query.order_by(desc(MaterialRoleAssignment.effective_date)).all()


@router.post("/material-roles/assign", response_model=MaterialRoleAssignmentResponse)
def assign_material_role(data: MaterialRoleAssignmentCreate, db: Session = Depends(get_db)):
    # Validate material
    material = db.query(Material).filter(Material.id == data.material_id).first()
    if not material:
        raise HTTPException(status_code=400, detail="Invalid material ID")

    now = data.effective_date or datetime.utcnow()

    # Prevent backdating
    if now < datetime.utcnow() - timedelta(minutes=1):  # Allow small leeway for network time
        raise HTTPException(status_code=400, detail="Effective date cannot be in the past.")

    # Close existing active assignment for this role
    existing = db.query(MaterialRoleAssignment).filter(
        MaterialRoleAssignment.role == data.role,
        MaterialRoleAssignment.effective_date <= now,
        (MaterialRoleAssignment.end_date == None) | (MaterialRoleAssignment.end_date > now)
    ).first()

    if existing:
        if existing.effective_date >= now:
            raise HTTPException(status_code=400, detail="Cannot supersede an assignment with same or future effective date.")
        existing.end_date = now

    new_assignment = MaterialRoleAssignment(
        role=data.role,
        material_id=data.material_id,
        effective_date=now
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    return new_assignment


# ------------------------------------------------------------------
# 2. Shipping Configuration
# ------------------------------------------------------------------

@router.get("/shipping/zones", response_model=List[ShippingZoneResponse])
def get_shipping_zones(db: Session = Depends(get_db)):
    return db.query(ShippingZone).order_by(ShippingZone.sort_order).all()


# --------------------------
# Rate Cards
# --------------------------

@router.get("/shipping/rate-cards", response_model=List[ShippingRateCardResponse])
def list_rate_cards(include_inactive: bool = False, db: Session = Depends(get_db)):
    """
    Hardening:
      - Avoid 500 if DB/model mismatch around `active`
      - Return a meaningful error detail + print stack trace
    """
    try:
        query = db.query(ShippingRateCard)

        # If the model doesn't have `active` (schema mismatch), don't filter by it.
        if hasattr(ShippingRateCard, "active"):
            if not include_inactive:
                query = query.filter(ShippingRateCard.active == True)  # noqa: E712

        return query.order_by(ShippingRateCard.name, ShippingRateCard.id).all()

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"rate-cards query failed: {e}")


@router.post("/shipping/rate-cards", response_model=ShippingRateCardResponse)
def create_rate_card(data: ShippingRateCardCreate, db: Session = Depends(get_db)):
    # Validate uniqueness of name
    existing = db.query(ShippingRateCard).filter(ShippingRateCard.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Rate card with this name already exists")

    # Build a safe dict from schema (frontend now sends only {name})
    payload = data.dict()

    # If the DB model has a carrier column, default it to USPS.
    # (This prevents a crash if the column exists & is non-nullable.)
    if hasattr(ShippingRateCard, "carrier") and "carrier" not in payload:
        payload["carrier"] = Carrier.USPS

    # If model has active and schema doesn't include it, default it True
    if hasattr(ShippingRateCard, "active") and "active" not in payload:
        payload["active"] = True

    card = ShippingRateCard(**payload)
    db.add(card)
    db.commit()
    db.refresh(card)
    return card


@router.put("/shipping/rate-cards/{card_id}", response_model=ShippingRateCardResponse)
def update_rate_card(card_id: int, data: ShippingRateCardUpdate, db: Session = Depends(get_db)):
    card = db.query(ShippingRateCard).filter(ShippingRateCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Rate card not found")

    if data.name is not None:
        # Check uniqueness if name changing
        if data.name != card.name:
            existing = db.query(ShippingRateCard).filter(ShippingRateCard.name == data.name).first()
            if existing:
                raise HTTPException(status_code=400, detail="Rate card with this name already exists")
        card.name = data.name

    if data.active is not None and hasattr(card, "active"):
        card.active = data.active

    db.commit()
    db.refresh(card)
    return card


@router.delete("/shipping/rate-cards/{card_id}")
def delete_rate_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(ShippingRateCard).filter(ShippingRateCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Rate card not found")

    # Soft delete (only if active exists)
    if hasattr(card, "active"):
        card.active = False
        db.commit()
        return {"message": "Rate card archived (soft deleted)"}

    # If the model doesn't support soft-delete, fail loudly
    raise HTTPException(status_code=500, detail="Rate card model does not support archiving (missing active column)")


# --------------------------
# Tiers
# --------------------------

@router.get("/shipping/rate-cards/{card_id}/tiers", response_model=List[ShippingRateTierResponse])
def list_tiers(card_id: int, include_inactive: bool = False, db: Session = Depends(get_db)):
    query = db.query(ShippingRateTier).filter(ShippingRateTier.rate_card_id == card_id)
    if hasattr(ShippingRateTier, "active") and not include_inactive:
        query = query.filter(ShippingRateTier.active == True)  # noqa: E712
    return query.order_by(ShippingRateTier.max_oz, ShippingRateTier.id).all()


@router.post("/shipping/rate-cards/{card_id}/tiers", response_model=ShippingRateTierResponse)
def create_tier_under_card(card_id: int, data: TierCreateRequest, db: Session = Depends(get_db)):
    # Verify card exists
    card = db.query(ShippingRateCard).filter(ShippingRateCard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Rate card not found")

    tier = ShippingRateTier(
        rate_card_id=card_id,
        min_oz=0.0,
        max_oz=data.max_weight_oz,
        label=data.label,
        active=True if hasattr(ShippingRateTier, "active") else None
    )
    db.add(tier)
    db.commit()
    db.refresh(tier)
    return tier


@router.put("/shipping/tiers/{tier_id}", response_model=ShippingRateTierResponse)
def update_tier(tier_id: int, data: ShippingRateTierUpdate, db: Session = Depends(get_db)):
    tier = db.query(ShippingRateTier).filter(ShippingRateTier.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    if data.label is not None:
        tier.label = data.label
    if data.max_weight_oz is not None:
        tier.max_oz = data.max_weight_oz
    if data.active is not None and hasattr(tier, "active"):
        tier.active = data.active

    db.commit()
    db.refresh(tier)
    return tier


@router.delete("/shipping/tiers/{tier_id}")
def delete_tier(tier_id: int, db: Session = Depends(get_db)):
    tier = db.query(ShippingRateTier).filter(ShippingRateTier.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    if hasattr(tier, "active"):
        tier.active = False
        db.commit()
        return {"message": "Tier archived"}

    raise HTTPException(status_code=500, detail="Tier model does not support archiving (missing active column)")


# --------------------------
# Zone Rates
# --------------------------

@router.get("/shipping/tiers/{tier_id}/zone-rates", response_model=List[ShippingZoneRateNormalizedResponse])
def list_zone_rates(tier_id: int, db: Session = Depends(get_db)):
    zones = db.query(ShippingZone).order_by(ShippingZone.sort_order).all()

    rates = db.query(ShippingZoneRate).filter(ShippingZoneRate.tier_id == tier_id).all()
    rate_map = {r.zone: r for r in rates}  # zone_id -> rate row

    results = []
    for z in zones:
        r = rate_map.get(z.id)
        results.append({
            "zone_id": z.id,
            "zone_code": z.code,
            "zone_name": z.name,
            "rate_cents": r.rate_cents if r else None,
            "zone_rate_id": r.id if r else None
        })

    return results


@router.put("/shipping/tiers/{tier_id}/zone-rates/{zone_id}", response_model=ShippingZoneRateNormalizedResponse)
def upsert_zone_rate(tier_id: int, zone_id: int, data: ShippingZoneRateUpsertRequest, db: Session = Depends(get_db)):
    tier = db.query(ShippingRateTier).filter(ShippingRateTier.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    zone = db.query(ShippingZone).filter(ShippingZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    existing_rate = db.query(ShippingZoneRate).filter(
        ShippingZoneRate.tier_id == tier_id,
        ShippingZoneRate.zone == zone_id
    ).first()

    returned_rate_id = None
    returned_cents = None

    if data.rate_cents is None:
        if existing_rate:
            db.delete(existing_rate)
            db.commit()
    else:
        if existing_rate:
            existing_rate.rate_cents = data.rate_cents
            db.commit()
            db.refresh(existing_rate)
            returned_rate_id = existing_rate.id
            returned_cents = existing_rate.rate_cents
        else:
            new_rate = ShippingZoneRate(
                rate_card_id=tier.rate_card_id,
                tier_id=tier_id,
                zone=zone_id,
                rate_cents=data.rate_cents
            )
            db.add(new_rate)
            db.commit()
            db.refresh(new_rate)
            returned_rate_id = new_rate.id
            returned_cents = new_rate.rate_cents

    return {
        "zone_id": zone.id,
        "zone_code": zone.code,
        "zone_name": zone.name,
        "rate_cents": returned_cents,
        "zone_rate_id": returned_rate_id
    }


@router.post("/shipping/zone-rates", response_model=ShippingZoneRateResponse)
def create_zone_rate(data: ShippingZoneRateCreate, db: Session = Depends(get_db)):
    existing = db.query(ShippingZoneRate).filter(
        ShippingZoneRate.tier_id == data.tier_id,
        ShippingZoneRate.zone == data.zone
    ).first()
    if existing:
        existing.rate_cents = data.rate_cents
        db.commit()
        db.refresh(existing)
        return existing

    rate = ShippingZoneRate(**data.dict())
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate


@router.put("/shipping/zone-rates/{rate_id}", response_model=ShippingZoneRateResponse)
def update_zone_rate(rate_id: int, data: ShippingZoneRateCreate, db: Session = Depends(get_db)):
    rate = db.query(ShippingZoneRate).filter(ShippingZoneRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    rate.rate_cents = data.rate_cents
    db.commit()
    db.refresh(rate)
    return rate


@router.delete("/shipping/zone-rates/{rate_id}")
def delete_zone_rate(rate_id: int, db: Session = Depends(get_db)):
    rate = db.query(ShippingZoneRate).filter(ShippingZoneRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate not found")
    db.delete(rate)
    db.commit()
    return {"message": "Rate deleted"}


# ------------------------------------------------------------------
# 3. Marketplace Profiles
# ------------------------------------------------------------------

@router.get("/shipping/marketplace-profiles", response_model=List[MarketplaceShippingProfileResponse])
def list_marketplace_profiles(include_history: bool = False, db: Session = Depends(get_db)):
    query = db.query(MarketplaceShippingProfile)
    if not include_history:
        now = datetime.utcnow()
        query = query.filter(
            MarketplaceShippingProfile.effective_date <= now,
            (MarketplaceShippingProfile.end_date == None) | (MarketplaceShippingProfile.end_date > now)
        )
    return query.all()


@router.post("/shipping/marketplace-profiles/assign", response_model=MarketplaceShippingProfileResponse)
def assign_marketplace_profile(data: MarketplaceShippingProfileCreate, db: Session = Depends(get_db)):
    now = data.effective_date or datetime.utcnow()

    # Prevent backdating
    if now < datetime.utcnow() - timedelta(minutes=1):
        raise HTTPException(status_code=400, detail="Effective date cannot be in the past.")

    existing = db.query(MarketplaceShippingProfile).filter(
        MarketplaceShippingProfile.marketplace == data.marketplace,
        MarketplaceShippingProfile.effective_date <= now,
        (MarketplaceShippingProfile.end_date == None) | (MarketplaceShippingProfile.end_date > now)
    ).first()

    if existing:
        if existing.effective_date >= now:
            raise HTTPException(status_code=400, detail="Cannot supersede an assignment with same or future effective date.")
        existing.end_date = now

    new_profile = MarketplaceShippingProfile(
        marketplace=data.marketplace,
        rate_card_id=data.rate_card_id,
        pricing_zone=data.pricing_zone,
        effective_date=now
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return new_profile


# --------------------------
# Defaults
# --------------------------

@router.get("/shipping/defaults", response_model=ShippingDefaultSettingResponse)
def get_shipping_defaults(db: Session = Depends(get_db)):
    settings = db.query(ShippingDefaultSetting).first()
    if not settings:
        settings = ShippingDefaultSetting()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/shipping/defaults", response_model=ShippingDefaultSettingResponse)
def update_shipping_defaults(data: ShippingDefaultSettingCreate, db: Session = Depends(get_db)):
    if data.shipping_mode not in ["flat", "calculated", "fixed_cell"]:
        raise HTTPException(status_code=400, detail="Invalid shipping_mode")

    assumed_present = [
        data.assumed_rate_card_id is not None,
        data.assumed_tier_id is not None,
        data.assumed_zone_code is not None
    ]

    if any(assumed_present) and not all(assumed_present):
        raise HTTPException(status_code=400, detail="If any assumed settings are provided (card, tier, zone), all must be provided.")

    if all(assumed_present):
        card = db.query(ShippingRateCard).filter(ShippingRateCard.id == data.assumed_rate_card_id).first()
        if not card:
            raise HTTPException(status_code=400, detail="Assumed rate card not found")

        tier = db.query(ShippingRateTier).filter(ShippingRateTier.id == data.assumed_tier_id).first()
        if not tier:
            raise HTTPException(status_code=400, detail="Assumed tier not found")

        if tier.rate_card_id != data.assumed_rate_card_id:
            raise HTTPException(status_code=400, detail="Assumed tier does not belong to the assumed rate card")

        if data.assumed_zone_code not in [str(i) for i in range(1, 10)]:  # 1..9
            raise HTTPException(status_code=400, detail="Assumed zone code must be '1' through '9'")

    settings = db.query(ShippingDefaultSetting).first()
    if not settings:
        settings = ShippingDefaultSetting()
        db.add(settings)

    settings.shipping_mode = data.shipping_mode
    settings.flat_shipping_cents = data.flat_shipping_cents
    settings.default_rate_card_id = data.default_rate_card_id
    settings.default_zone_code = data.default_zone_code

    settings.assumed_rate_card_id = data.assumed_rate_card_id
    settings.assumed_tier_id = data.assumed_tier_id
    settings.assumed_zone_code = data.assumed_zone_code

    settings.shipping_settings_version += 1

    db.commit()
    db.refresh(settings)
    return settings


# ------------------------------------------------------------------
# 4. Labor Settings
# ------------------------------------------------------------------

@router.get("/labor", response_model=LaborSettingResponse)
def get_labor_settings(db: Session = Depends(get_db)):
    settings = db.query(LaborSetting).first()
    if not settings:
        settings = LaborSetting()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/labor", response_model=LaborSettingResponse)
def update_labor_settings(data: LaborSettingCreate, db: Session = Depends(get_db)):
    settings = db.query(LaborSetting).first()
    if not settings:
        settings = LaborSetting()
        db.add(settings)

    settings.hourly_rate_cents = data.hourly_rate_cents
    settings.minutes_no_padding = data.minutes_no_padding
    settings.minutes_with_padding = data.minutes_with_padding

    db.commit()
    db.refresh(settings)
    return settings


# ------------------------------------------------------------------
# 5. Marketplace Fees
# ------------------------------------------------------------------

@router.get("/marketplace-fees", response_model=List[MarketplaceFeeRateResponse])
def list_fees(db: Session = Depends(get_db)):
    return db.query(MarketplaceFeeRate).all()


@router.put("/marketplace-fees", response_model=MarketplaceFeeRateResponse)
def update_fee(data: MarketplaceFeeRateCreate, db: Session = Depends(get_db)):
    fee = db.query(MarketplaceFeeRate).filter(MarketplaceFeeRate.marketplace == data.marketplace).first()
    if not fee:
        fee = MarketplaceFeeRate(marketplace=data.marketplace)
        db.add(fee)

    fee.fee_rate = data.fee_rate
    db.commit()
    db.refresh(fee)
    return fee


# ------------------------------------------------------------------
# 6. Profits
# ------------------------------------------------------------------

@router.get("/profits", response_model=List[VariantProfitSettingResponse])
def list_profits(db: Session = Depends(get_db)):
    return db.query(VariantProfitSetting).all()


@router.put("/profits", response_model=VariantProfitSettingResponse)
def update_profit(data: VariantProfitSettingCreate, db: Session = Depends(get_db)):
    profit = db.query(VariantProfitSetting).filter(VariantProfitSetting.variant_key == data.variant_key).first()
    if not profit:
        profit = VariantProfitSetting(variant_key=data.variant_key)
        db.add(profit)

    profit.profit_cents = data.profit_cents
    db.commit()
    db.refresh(profit)
    return profit


# ------------------------------------------------------------------
# 7. Export Settings
# ------------------------------------------------------------------

from app.models.core import ExportSetting
from app.schemas.core import ExportSettingResponse, ExportSettingCreate

@router.get("/export", response_model=ExportSettingResponse)
def get_export_settings(db: Session = Depends(get_db)):
    settings = db.query(ExportSetting).first()
    if not settings:
        settings = ExportSetting(default_save_path_template="")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.put("/export", response_model=ExportSettingResponse)
def update_export_settings(data: ExportSettingCreate, db: Session = Depends(get_db)):
    settings = db.query(ExportSetting).first()
    if not settings:
        settings = ExportSetting()
        db.add(settings)

    settings.default_save_path_template = data.default_save_path_template
    db.commit()
    db.refresh(settings)
    return settings
