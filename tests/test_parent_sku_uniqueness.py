
import sys
import os
sys.path.append(os.getcwd())

from app.api.models import generate_unique_parent_sku
from app.models.core import Model, Series, Manufacturer
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
import sys

# Setup in-memory DB for testing globals for standalone run
engine = create_engine('sqlite:///:memory:')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    return db

def test_sku_uniqueness_logic(db):
    # Setup Data
    mfr = Manufacturer(name="Fender")
    db.add(mfr)
    db.commit()
    
    series_x = Series(name="American", manufacturer_id=mfr.id)
    series_y = Series(name="Mexican", manufacturer_id=mfr.id)
    db.add(series_x)
    db.add(series_y)
    db.commit()
    
    # Test 1: No collision returns base SKU
    # "Stratocaster" -> STRATOCASTER
    sku1 = generate_unique_parent_sku(db, series_x.id, mfr.name, series_x.name, "Stratocaster")
    assert len(sku1) == 40
    # Create the model to occupy the SKU
    m1 = Model(name="Stratocaster", series_id=series_x.id, equipment_type_id=1, width=1, depth=1, height=1, parent_sku=sku1)
    db.add(m1)
    db.commit()
    print(f"Test 1 SKU: {sku1}")

    # Test 2: Tail borrow resolves
    # "Stratocaster Elite" -> First 13 chars same as "Stratocaster" (STRATOCASTERX vs STRATOCASTER)
    # Actually name processing: "Stratocaster" -> "STRATOCASTERX" (13 chars)
    # "Stratocaster Elite" -> "STRATOCASTERELITE" -> "STRATOCASTERE" (13 chars)
    # Wait, "Stratocaster" -> 12 chars. Padded to 13 with X? Defaults to 'X' pad char?
    # generate_parent_sku uses 'X' padding.
    # STRATOCASTER (12) -> STRATOCASTERX (13).
    # Stratocaster Elite -> STRATOCASTERELITE (17) -> STRATOCASTERE (13). 
    # These are ALREADY diferent. "X" vs "E".
    # I need a collision in the first 13 chars.
    # "Stratocaster" vs "Stratocaster" (Duplicate name in same series - typically caught by unique constraint on name, but maybe allowed?)
    # "Stratocaster" vs "Stratocaster Reissue" -> STRATOCASTERX vs STRATOCASTERR -> Different.
    # Need prefixes to match.
    # Name 1: "Super Sonic" -> SUPERSONICXXX
    # Name 2: "Super Sonic Pro" -> SUPERSONICPRO
    # "Super Sonic" -> 10 chars. Padded: SUPERSONICXXX.
    # "Super Sonic Pro" -> 13 chars. SUPERSONICPRO. Different.
    
    # Providing IDENTICAL name 2nd time should rely on exclusion check? No, create_model uses generate_unique_parent_sku BEFORE creating properties.
    # If I try to generate SKU for "Stratocaster" AGAIN in Series X, it should collide with m1.
    sku2 = generate_unique_parent_sku(db, series_x.id, mfr.name, series_x.name, "Stratocaster")
    assert len(sku2) == 40
    assert sku2 != sku1
    # Should use tail borrowing? "Stratocaster" processed full is "STRATOCASTER". Tail is empty if len < 13?
    # If tail is empty, loop range(1, 1) is empty. Skips to counter.
    # Let's see. 
    print(f"Test 2 SKU (Collision 'Stratocaster'): {sku2}")
    
    # Test 2b: Real Tail Borrowing
    # "Telecaster Deluxe" -> TELECASTERDEL (13). Full: TELECASTERDELUXE. Tail: UXE.
    # "Telecaster Deluxe" -> SKU A.
    # "Telecaster Deluxe Reissue" -> TELECASTERDEL (13). Full: TELECASTERDELUXEREISSUE. Tail: UXEREISSUE.
    # SKU A for "Telecaster Deluxe"
    sku3 = generate_unique_parent_sku(db, series_x.id, mfr.name, series_x.name, "Telecaster Deluxe")
    m3 = Model(name="Telecaster Deluxe", series_id=series_x.id, equipment_type_id=1, width=1, depth=1, height=1, parent_sku=sku3)
    db.add(m3)
    db.commit()
    
    # Collision Candidate: "Telecaster Deluxe Reissue" (First 13 chars identical "TELECASTERDEL")
    # Base SKU will be same as sku3.
    # Should borrow 'U' from tail (UXEREISSUE) -> TELECASTERDEU ?
    # Wait. 
    # Base SKU model segment: TELECASTERDEL
    # Tail Borrow 1 char: TELECASTERDE + U = TELECASTERDEU
    sku4 = generate_unique_parent_sku(db, series_x.id, mfr.name, series_x.name, "Telecaster Deluxe Reissue")
    assert len(sku4) == 40
    assert sku4 != sku3
    # Verify modification is in model segment
    assert sku4[:18] == sku3[:18] # Mfr + Series same
    assert sku4[31:] == sku3[31:] # Version same
    print(f"Test 2b SKU (Tail Borrow): {sku4}")

    # Test 3: Counter fallback resolve
    # "Jaguar" -> JAGUARXXXXXXX. Full: JAGUAR. Tail empty.
    sku5 = generate_unique_parent_sku(db, series_x.id, mfr.name, series_x.name, "Jaguar")
    m5 = Model(name="Jaguar", series_id=series_x.id, equipment_type_id=1, width=1, depth=1, height=1, parent_sku=sku5)
    db.add(m5)
    db.commit()
    
    # Collision "Jaguar" again. Tail empty -> Tail borrow loop skipped. Goes to Counter.
    sku6 = generate_unique_parent_sku(db, series_x.id, mfr.name, series_x.name, "Jaguar")
    assert len(sku6) == 40
    assert sku6 != sku5
    # Check last 2 chars of model segment (index 29, 30).
    # Base: JAGUARXXXXXXX
    # Counter 0 (00): JAGUARXXXXX00
    segment6 = sku6[18:31]
    assert segment6.endswith("00")
    print(f"Test 3 SKU (Counter): {sku6}")
    
    # Test 4: Series Scoping
    # "Stratocaster" in Series Y. Should get base SKU (same as sku1 but with Series Y code)
    # Does NOT need to be unique from Series X.
    sku7 = generate_unique_parent_sku(db, series_y.id, mfr.name, series_y.name, "Stratocaster")
    
    # Verify Series part is different
    assert sku7[9:17] != sku1[9:17] 
    
    # Verify Model part is IDENTICAL to sku1's model part (STRATOCASTERX)
    # because it shouldn't collide in Series Y DB.
    assert sku7[18:31] == sku1[18:31]
    print(f"Test 4 SKU (Series Scope): {sku7}")

if __name__ == "__main__":
    # Manually run if executed directly
    try:
        from sqlalchemy import create_engine
        engine = create_engine('sqlite:///:memory:')
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        Base.metadata.create_all(bind=engine)
        test_sku_uniqueness_logic(db)
        print("ALL TESTS PASSED")
    except Exception as e:
        print(f"TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
