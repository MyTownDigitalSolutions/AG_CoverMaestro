from app.database import SessionLocal
from app.models.core import ShippingZone

def verify_zones():
    db = SessionLocal()
    try:
        zones = db.query(ShippingZone).all()
        print(f"Count of zones: {len(zones)}")
        for z in zones:
            print(f"Zone: {z.code} - {z.name}")
    finally:
        db.close()

if __name__ == "__main__":
    verify_zones()
