from sqlalchemy.orm import Session
from app.database import get_db
from app.models.core import Model

def debug_data():
    db = next(get_db())
    try:
        model = db.query(Model).filter(Model.name == "57 Custom Champ").first()
        if not model:
            print("Model '57 Custom Champ' not found.")
            return

        print(f"Model: {model.name} (ID: {model.id})")
        print(f"Legacy reverb_product_id: '{model.reverb_product_id}'")
        
        print(f"Marketplace Listings Count: {len(model.marketplace_listings)}")
        for listing in model.marketplace_listings:
             print(f" - Marketplace: {listing.marketplace} | ID: {listing.external_id}")

    finally:
        db.close()

if __name__ == "__main__":
    debug_data()
