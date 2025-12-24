
import os
import unittest
from datetime import datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.core import (
    ShippingRateCard, ShippingRateTier, ShippingZoneRate, 
    MarketplaceShippingProfile, ShippingDefaultSetting, ShippingZone
)
from app.models.enums import Carrier
from app.services.pricing_calculator import PricingCalculator

class TestTierSelection(unittest.TestCase):
    def setUp(self):
        # In-memory DB
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Setup Data
        self.card = ShippingRateCard(name="Test Card", carrier=Carrier.USPS, active=True)
        self.db.add(self.card)
        self.db.flush()

        # Tiers: 4, 8, 12, 15.999, 16
        # Costs: 100, 200, 300, 400, 500
        tiers_data = [
            (4.0, 100),
            (8.0, 200),
            (12.0, 300),
            (15.999, 400),
            (16.0, 500)
        ]

        self.zone = ShippingZone(code="1", name="Zone 1", sort_order=1)
        self.db.add(self.zone)
        self.db.flush()

        for max_oz, cost in tiers_data:
            t = ShippingRateTier(
                rate_card_id=self.card.id,
                min_oz=0, # Not used in new logic really
                max_oz=max_oz,
                active=True
            )
            self.db.add(t)
            self.db.flush()
            
            # Add rate for this tier
            r = ShippingZoneRate(
                rate_card_id=self.card.id,
                tier_id=t.id,
                zone=self.zone.id,
                rate_cents=cost
            )
            self.db.add(r)
        
        # Profile
        self.profile = MarketplaceShippingProfile(
            marketplace="test_market",
            rate_card_id=self.card.id,
            pricing_zone=self.zone.id,
            effective_date=datetime.utcnow()
        )
        self.db.add(self.profile)

        # Defaults (required for PricingCalculator init/helpers)
        self.defaults = ShippingDefaultSetting(
            shipping_mode="calculated",
            default_zone_code="1"
        )
        self.db.add(self.defaults)
        
        self.db.commit()
        self.calculator = PricingCalculator(self.db)

    def tearDown(self):
        self.db.close()

    def test_tier_selection_usps_logic(self):
        """
        Verifies that for a given weight, we pick the smallest tier where max_oz >= weight.
        """
        # weight 7 -> should fit in 8 (Cost 200). 
        # (4 is too small. 8 is >= 7. 8 is smallest of remaining)
        cost_7 = self.calculator._get_shipping_cost_cents(self.profile, 7.0)
        self.assertEqual(cost_7, 200, "Weight 7 should match Tier 8 (Cost 200)")

        # weight 15.999 -> Matches Tier 15.999 exactly (Cost 400)
        cost_15_999 = self.calculator._get_shipping_cost_cents(self.profile, 15.999)
        self.assertEqual(cost_15_999, 400, "Weight 15.999 should match Tier 15.999 (Cost 400)")

        # weight 16.0 -> Matches Tier 16 (Cost 500)
        # Tier 15.999 is too small (15.999 < 16.0). 
        cost_16 = self.calculator._get_shipping_cost_cents(self.profile, 16.0)
        self.assertEqual(cost_16, 500, "Weight 16.0 should match Tier 16 (Cost 500)")
        
        # weight 11 -> Matches Tier 12 (Cost 300)
        cost_11 = self.calculator._get_shipping_cost_cents(self.profile, 11.0)
        self.assertEqual(cost_11, 300, "Weight 11 should match Tier 12 (Cost 300)")

        # weight 16.0001 -> Should fail (nothing > 16)
        with self.assertRaises(ValueError) as cm:
            self.calculator._get_shipping_cost_cents(self.profile, 16.0001)
        self.assertIn("weight exceeds max available tier", str(cm.exception))

if __name__ == '__main__':
    unittest.main()
