from app.database import SessionLocal
from app.services.pricing_calculator import PricingCalculator
from app.models.core import Model
import traceback

def test_reverb_only():
    db = SessionLocal()
    try:
        model = db.query(Model).first()
        if not model:
            print("No models found", flush=True)
            return

        print(f"Testing Reverb Recalc for Model {model.id} ({model.name})...", flush=True)
        
        calc = PricingCalculator(db)
        try:
            calc.calculate_model_prices(model.id, marketplace="reverb")
            print("REVERB_RECALC_SUCCESS", flush=True)
        except Exception as e:
            print("REVERB_RECALC_FAILED", flush=True)
            print(f"Error: {e}", flush=True)
            traceback.print_exc()

    finally:
        db.close()

if __name__ == "__main__":
    test_reverb_only()
