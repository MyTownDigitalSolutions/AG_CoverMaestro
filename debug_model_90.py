from app.database import SessionLocal
from app.services.pricing_calculator import PricingCalculator
from app.models.core import Model, ModelPricingSnapshot, MarketplaceFeeRate
import traceback

def debug_90():
    db = SessionLocal()
    try:
        model = db.query(Model).filter(Model.id == 90).first()
        if not model:
            print("Model 90 not found!")
            # Try to find 'Acoustasonic' -> '90' is name? 
            # Screenshot row: '90', Series 'Acoustasonic'.
            # Model Name is '90'.
            m = db.query(Model).filter(Model.name == "90").first()
            if m:
                print(f"Found model by name '90': ID {m.id}")
                model = m
            else:
                 return

        print(f"Model: {model.id} {model.name}")
        print(f"Dimensions: {model.width}x{model.depth}x{model.height}")
        print(f"Surface Area: {model.surface_area_sq_in}")
        
        # Check Fee Rate
        fee = db.query(MarketplaceFeeRate).filter(MarketplaceFeeRate.marketplace == "reverb").first()
        print(f"Reverb Fee Rate: {fee.fee_rate if fee else 'MISSING'}")

        # Check existing snapshots
        snaps = db.query(ModelPricingSnapshot).filter(
            ModelPricingSnapshot.model_id == model.id,
            ModelPricingSnapshot.marketplace == "reverb"
        ).all()
        print(f"Existing Reverb Snapshots: {len(snaps)}")
        for s in snaps:
            print(f" - {s.variant_key}: {s.retail_price_cents}")

        # Try Recalc
        print("Running Recalc...")
        calc = PricingCalculator(db)
        try:
            calc.calculate_model_prices(model.id, marketplace="reverb")
            db.commit() # COMMIT THIS TIME
            print("Recalc Success & Committed.")
        except Exception as e:
            print(f"Recalc Failed: {e}")
            traceback.print_exc()

        # Check again
        snaps = db.query(ModelPricingSnapshot).filter(
            ModelPricingSnapshot.model_id == model.id,
            ModelPricingSnapshot.marketplace == "reverb"
        ).all()
        print(f"Post-Recalc Reverb Snapshots: {len(snaps)}")
        for s in snaps:
            print(f" - {s.variant_key}: {s.retail_price_cents}")

    finally:
        db.close()

if __name__ == "__main__":
    debug_90()
