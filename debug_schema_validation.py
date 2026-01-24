from app.database import SessionLocal
from app.models.core import Model, Series, ModelPricingSnapshot
from app.schemas.core import ModelPricingSnapshotResponse
from sqlalchemy import func
import traceback

def debug_schema():
    db = SessionLocal()
    try:
        # 1. Find the model
        model = db.query(Model).join(Series).filter(
            Model.name == "90",
            Series.name.ilike("%Acoustasonic%")
        ).first()

        if not model:
            print("Model 90 not found for schema check")
            return

        print(f"Checking Schema for Model {model.id} ({model.name})")

        # 2. Get snapshots for Reverb
        snaps = db.query(ModelPricingSnapshot).filter(
            ModelPricingSnapshot.model_id == model.id,
            ModelPricingSnapshot.marketplace == "reverb"
        ).all()
        
        print(f"Found {len(snaps)} snapshots.")
        
        for s in snaps:
            print(f"Validating Snapshot {s.id} ({s.variant_key})...")
            try:
                # Manually convert SQLAlchemy model to Pydantic
                # Pydantic v2 use model_validate? Or from_orm?
                # Schema uses Config: from_attributes = True (v2 syntax) or orm_mode (v1)
                # app.schemas.core uses `from_attributes = True`, suggesting Pydantic v2.
                
                dto = ModelPricingSnapshotResponse.model_validate(s)
                print("  -> VALID")
            except Exception as e:
                print(f"  -> INVALID: {e}")
                # Print all fields to see what is missing
                print(f"     Data: raw_cost={s.raw_cost_cents}, base_cost={s.base_cost_cents}, retail={s.retail_price_cents}")
                print(f"     Data: weight={s.weight_oz}, calculated_at={s.calculated_at}")

    finally:
        db.close()

if __name__ == "__main__":
    debug_schema()
