from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.core import PricingOption, ShippingRate
from app.schemas.core import (
    PricingOptionCreate, PricingOptionResponse,
    ShippingRateCreate, ShippingRateResponse,
    PricingCalculateRequest, PricingCalculateResponse
)
from app.services.pricing_service import PricingService

router = APIRouter(prefix="/pricing", tags=["pricing"])

@router.post("/calculate", response_model=PricingCalculateResponse)
def calculate_pricing(data: PricingCalculateRequest, db: Session = Depends(get_db)):
    try:
        service = PricingService(db)
        result = service.calculate_total(
            model_id=data.model_id,
            material_id=data.material_id,
            colour=data.colour,
            quantity=data.quantity,
            handle_zipper=data.handle_zipper,
            two_in_one_pocket=data.two_in_one_pocket,
            music_rest_zipper=data.music_rest_zipper,
            carrier=data.carrier,
            zone=data.zone
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/options", response_model=List[PricingOptionResponse])
def list_pricing_options(db: Session = Depends(get_db)):
    return db.query(PricingOption).all()

@router.post("/options", response_model=PricingOptionResponse)
def create_pricing_option(data: PricingOptionCreate, db: Session = Depends(get_db)):
    option = PricingOption(name=data.name, price=data.price)
    db.add(option)
    db.commit()
    db.refresh(option)
    return option

@router.get("/shipping-rates", response_model=List[ShippingRateResponse])
def list_shipping_rates(db: Session = Depends(get_db)):
    return db.query(ShippingRate).all()

@router.post("/shipping-rates", response_model=ShippingRateResponse)
def create_shipping_rate(data: ShippingRateCreate, db: Session = Depends(get_db)):
    rate = ShippingRate(
        carrier=data.carrier,
        min_weight=data.min_weight,
        max_weight=data.max_weight,
        zone=data.zone,
        rate=data.rate,
        surcharge=data.surcharge
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate
