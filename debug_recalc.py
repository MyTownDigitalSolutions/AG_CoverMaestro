from app.database import SessionLocal
from app.services.pricing_calculator import PricingCalculator
from app.models.core import Model

def test_recalc():
    db = SessionLocal()
    try:
        # Get first model
        model = db.query(Model).first()
        if not model:
            print("No models found")
            return

        print(f"Testing Recalc for Model {model.id} ({model.name}) on Reverb...", flush=True)
        
        calc = PricingCalculator(db)
        try:
            calc.calculate_model_prices(model.id, marketplace="reverb")
            print("Reverb Recalc: SUCCESS", flush=True)
        except Exception as e:
            print(f"Reverb Recalc: FAILED - {e}", flush=True)

        print(f"Testing Recalc for Model {model.id} ({model.name}) on Amazon...", flush=True)
        try:
            calc.calculate_model_prices(model.id, marketplace="amazon")
            print("Amazon Recalc: SUCCESS", flush=True)
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Amazon Recalc: FAILED - {e}", flush=True)
            
    finally:
        db.close()

if __name__ == "__main__":
    test_recalc()
