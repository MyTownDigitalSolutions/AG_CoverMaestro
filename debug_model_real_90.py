from app.database import SessionLocal
from app.services.pricing_calculator import PricingCalculator
from app.models.core import Model, Series, ModelPricingSnapshot
import traceback

def debug_real_90():
    db = SessionLocal()
    try:
        # SEARCH for Model named "90" in Series "Acoustasonic"
        model = db.query(Model).join(Series).filter(
            Model.name == "90",
            Series.name.ilike("%Acoustasonic%")
        ).first()

        if not model:
            print("Could not find Model named '90' in Acoustasonic series!")
            # Try just name 90
            models = db.query(Model).filter(Model.name == "90").all()
            print(f"Found {len(models)} models named '90'.")
            for m in models:
                 print(f" - ID: {m.id}, Name: {m.name}, Series: {m.series.name}")
                 model = m # Pick last one or first one to test
        
        if not model:
            return

        print(f"Target Model: ID {model.id} ({model.name}) Series: {model.series.name}")
        
        # Check existing snapshots for REVERB
        snaps = db.query(ModelPricingSnapshot).filter(
            ModelPricingSnapshot.model_id == model.id,
            ModelPricingSnapshot.marketplace == "reverb"
        ).all()
        print(f"Existing Reverb Snapshots: {len(snaps)}")

        # Try Recalc
        print("Running Recalc for THIS model...")
        calc = PricingCalculator(db)
        try:
            calc.calculate_model_prices(model.id, marketplace="reverb")
            db.commit()
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

    finally:
        db.close()

if __name__ == "__main__":
    debug_real_90()
