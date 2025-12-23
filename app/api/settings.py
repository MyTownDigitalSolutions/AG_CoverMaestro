from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.core import (
    MaterialRoleAssignment, Material, 
    ShippingRateCard, ShippingRateTier, ShippingZoneRate, MarketplaceShippingProfile,
    LaborSetting, MarketplaceFeeRate, VariantProfitSetting
)
from app.schemas.core import (
    MaterialRoleAssignmentCreate, MaterialRoleAssignmentResponse,
    ShippingRateCardCreate, ShippingRateCardResponse,
    ShippingRateTierCreate, ShippingRateTierResponse,
    ShippingZoneRateCreate, ShippingZoneRateResponse,
    MarketplaceShippingProfileCreate, MarketplaceShippingProfileResponse,
    LaborSettingCreate, LaborSettingResponse,
    MarketplaceFeeRateCreate, MarketplaceFeeRateResponse,
    VariantProfitSettingCreate, VariantProfitSettingResponse
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
    if now < datetime.utcnow() - datetime.timedelta(minutes=1): # Allow small leeway for network time
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

# Rate Cards
@router.get("/shipping/rate-cards", response_model=List[ShippingRateCardResponse])
def list_rate_cards(db: Session = Depends(get_db)):
    return db.query(ShippingRateCard).all()

@router.post("/shipping/rate-cards", response_model=ShippingRateCardResponse)
def create_rate_card(data: ShippingRateCardCreate, db: Session = Depends(get_db)):
    card = ShippingRateCard(**data.dict())
    db.add(card)
    db.commit()
    db.refresh(card)
    return card

# Tiers
@router.get("/shipping/rate-cards/{card_id}/tiers", response_model=List[ShippingRateTierResponse])
def list_tiers(card_id: int, db: Session = Depends(get_db)):
    return db.query(ShippingRateTier).filter(ShippingRateTier.rate_card_id == card_id).all()

@router.post("/shipping/tiers", response_model=ShippingRateTierResponse)
def create_tier(data: ShippingRateTierCreate, db: Session = Depends(get_db)):
    tier = ShippingRateTier(**data.dict())
    db.add(tier)
    db.commit()
    db.refresh(tier)
    return tier

@router.put("/shipping/tiers/{tier_id}", response_model=ShippingRateTierResponse)
def update_tier(tier_id: int, data: ShippingRateTierCreate, db: Session = Depends(get_db)):
    tier = db.query(ShippingRateTier).filter(ShippingRateTier.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    tier.min_oz = data.min_oz
    tier.max_oz = data.max_oz
    tier.label = data.label
    db.commit()
    db.refresh(tier)
    return tier

@router.delete("/shipping/tiers/{tier_id}")
def delete_tier(tier_id: int, db: Session = Depends(get_db)):
    tier = db.query(ShippingRateTier).filter(ShippingRateTier.id == tier_id).first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")
    db.delete(tier)
    db.commit()
    return {"message": "Tier deleted"}

# Zone Rates
@router.get("/shipping/tiers/{tier_id}/zone-rates", response_model=List[ShippingZoneRateResponse])
def list_zone_rates(tier_id: int, db: Session = Depends(get_db)):
    return db.query(ShippingZoneRate).filter(ShippingZoneRate.tier_id == tier_id).all()

@router.post("/shipping/zone-rates", response_model=ShippingZoneRateResponse)
def create_zone_rate(data: ShippingZoneRateCreate, db: Session = Depends(get_db)):
    # Check uniqueness
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
    if now < datetime.utcnow() - datetime.timedelta(minutes=1): 
        raise HTTPException(status_code=400, detail="Effective date cannot be in the past.")

    # Close existing
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

# ------------------------------------------------------------------
# 4. Labor Settings
# ------------------------------------------------------------------

@router.get("/labor", response_model=LaborSettingResponse)
def get_labor_settings(db: Session = Depends(get_db)):
    settings = db.query(LaborSetting).first()
    if not settings:
        # Create default if missing
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
