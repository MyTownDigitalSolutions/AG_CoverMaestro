from sqlalchemy.orm import Session
from app.database import get_db
from app.models.core import Model, MarketplaceListing
from app.services.reverb_export_service import generate_reverb_export_csv
import csv
import io

def debug_real_model():
    db = next(get_db())
    try:
        # Find 57 Custom Champ (known to have ID in previous screenshot)
        model = db.query(Model).filter(Model.name == "57 Custom Champ").first()
        if not model:
            print("Model '57 Custom Champ' not found.")
            return

        print(f"Checking Model: {model.name} (ID: {model.id})")
        
        # Check Listings
        print("Marketplace Listings:")
        has_reverb = False
        for listing in model.marketplace_listings:
            print(f" - Marketplace: '{listing.marketplace}', ID: '{listing.external_id}'")
            if listing.marketplace.lower() == 'reverb' and listing.external_id:
                has_reverb = True
        
        print(f"Has Reverb Listing for Logic? {has_reverb}")
        
        # Run Export
        print("\nRunning Export Service...")
        buffer, filename = generate_reverb_export_csv(db, [model.id])
        content = buffer.read().decode('utf-8')
        
        # Parse CSV
        reader = csv.DictReader(io.StringIO(content))
        row = next(reader)
        
        print("\nExport Result:")
        print(f"new_listing: {row.get('new_listing')}")
        
        if has_reverb and row.get('new_listing') == "FALSE":
            print("SUCCESS: Logic correctly set FALSE.")
        elif not has_reverb and row.get('new_listing') == "TRUE":
             print("SUCCESS: Logic correctly kept TRUE (No ID).")
        else:
             print("FAILURE: Logic did not match expectation.")

    finally:
        db.close()

if __name__ == "__main__":
    debug_real_model()
