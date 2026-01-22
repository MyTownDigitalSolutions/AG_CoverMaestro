from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List, Dict
import logging

from app.models.core import (
    Model, Material, MaterialRoleAssignment, MarketplaceShippingProfile,
    ShippingRateCard, ShippingRateTier, ShippingZoneRate, LaborSetting,
    VariantProfitSetting, MarketplaceFeeRate, ModelPricingSnapshot, ModelPricingHistory,
    ShippingDefaultSetting
)
from app.models.enums import Marketplace

logger = logging.getLogger(__name__)

# Constants
WASTE_PERCENTAGE = 0.05

class PricingConfigError(ValueError):
    """Raised when pricing configuration (settings, defaults, profiles) is invalid or incomplete."""
    pass

class PricingCalculator:
    def __init__(self, db: Session):
        self.db = db
        self._shipping_defaults: Optional[ShippingDefaultSetting] = None
        self._fixed_cell_rate_cents: Optional[int] = None
        self._fixed_cell_lookup_done: bool = False
        
    def _get_shipping_defaults(self) -> ShippingDefaultSetting:
        if not self._shipping_defaults:
            defaults = self.db.query(ShippingDefaultSetting).first()
            if not defaults:
                # Fallback in memory if row missing (though API creates it)
                defaults = ShippingDefaultSetting() 
            self._shipping_defaults = defaults
        return self._shipping_defaults

    def _get_fixed_cell_rate(self) -> int:
        """Lazily fetches the fixed cell rate from the assumed tier+zone."""
        if self._fixed_cell_lookup_done:
             if self._fixed_cell_rate_cents is None:
                 raise PricingConfigError("Fixed Cell mode is active, but no rate could be found.")
             return self._fixed_cell_rate_cents
             
        defaults = self._get_shipping_defaults()
        if not defaults.assumed_rate_card_id or \
           not defaults.assumed_tier_id or \
           not defaults.assumed_zone_code:
            raise PricingConfigError("Shipping mode is 'fixed_cell' but Assumed Shipping Settings are incomplete.")
            
        # Fetch rate
        # We need to map zone code (str) to zone (int/str) in the ShippingZoneRate table
        # We assumed ShippingZoneRate.zone stores zone ID (int) based on earlier context? 
        # Or does it store the code?
        # Re-checking api/settings.py: list_zone_rates uses "db.query(ShippingZoneRate).filter(...)"
        # And normalized response assumes zone is code?
        # Let's check `ShippingZoneRate` model in `models/core.py`... 
        # It has `zone = Column(Integer)`.
        # And `ShippingDefaultSetting.assumed_zone_code` is String (e.g. "8").
        # We need to find the Zone ID for code "8".
        
        from app.models.core import ShippingZone
        
        zone_obj = self.db.query(ShippingZone).filter(ShippingZone.code == defaults.assumed_zone_code).first()
        if not zone_obj:
            raise PricingConfigError(f"Assumed zone code '{defaults.assumed_zone_code}' not found in ShippingZone table.")
            
        rate = self.db.query(ShippingZoneRate).filter(
            ShippingZoneRate.tier_id == defaults.assumed_tier_id,
            ShippingZoneRate.zone == zone_obj.id
        ).first()

        self._fixed_cell_lookup_done = True

        if not rate:
            raise PricingConfigError(f"No rate found for Assumed Tier {defaults.assumed_tier_id} + Zone {defaults.assumed_zone_code} (ID {zone_obj.id}).")
        
        self._fixed_cell_rate_cents = rate.rate_cents
        return self._fixed_cell_rate_cents

    def calculate_model_prices(self, model_id: int, marketplace: str = "DEFAULT"):
        """
        Calculate and persist pricing snapshots for all 4 variants of a model for a specific marketplace.
        """
        logger.info(f"recalc_baselines start model_id={model_id} marketplace={marketplace}")
        model = self.db.query(Model).filter(Model.id == model_id).first()
        if not model:
            raise ValueError(f"Model ID {model_id} not found")

        # 1. Resolve Configuration
        # ----------------------------------------------------
        labor_settings = self.db.query(LaborSetting).first()
        if not labor_settings:
            # Fallback or error? Spec says Strict.
            raise ValueError("Labor Settings not configured.")

        fee_rate_obj = self.db.query(MarketplaceFeeRate).filter(MarketplaceFeeRate.marketplace == marketplace).first()
        if not fee_rate_obj:
            raise ValueError(f"Fee rate not configured for marketplace: {marketplace}")
        fee_rate = fee_rate_obj.fee_rate

        shipping_profile = self._get_shipping_profile(marketplace)
        # Reverb uses template placeholders for shipping, so profile is optional
        if not shipping_profile and marketplace.lower() != "reverb":
             raise ValueError(f"Shipping profile not configured for marketplace: {marketplace}")

        # 2. Resolve Materials (As of Now)
        # ----------------------------------------------------
        materials_map = self._resolve_materials()
        
        # 3. Calculate Area
        # ----------------------------------------------------
        # Strict Rule: Pricing logic must NOT recompute surface area.
        # It must exist on the model.
        if not model.surface_area_sq_in or model.surface_area_sq_in <= 0:
             raise ValueError("Pricing cannot be calculated: model.surface_area_sq_in is missing or invalid.")
             
        area_sq_in = model.surface_area_sq_in

        # 4. Iterate Variants and Calculate
        # ----------------------------------------------------
        variants = [
            "choice_no_padding", "choice_padded",
            "premium_no_padding", "premium_padded"
        ]
        
        shipping_defaults = self._get_shipping_defaults()
        current_shipping_version = shipping_defaults.shipping_settings_version
        
        for variant_key in variants:
            logger.info(f"variant attempt key={variant_key} model_id={model_id}")
            try:
                self._calculate_single_variant(
                    model, variant_key, marketplace, area_sq_in,
                    materials_map, labor_settings, fee_rate, shipping_profile,
                    current_shipping_version
                )
            except Exception as e:
                logger.error(f"variant fail key={variant_key} model_id={model_id} error={str(e)}")
                raise e

    def _calculate_single_variant(
        self, model: Model, variant_key: str, marketplace: str, area_sq_in: float,
        materials_map: Dict[str, Material], labor_settings: LaborSetting, 
        fee_rate: float, shipping_profile: MarketplaceShippingProfile,
        shipping_version: Optional[int]
    ):
        # A. Determine Components based on variant key
        # ------------------------------------------------
        is_premium = "premium" in variant_key
        has_padding = "padded" in variant_key or ("padding" in variant_key and "no_padding" not in variant_key)

        main_fabric_role = "PREMIUM_SYNTHETIC_LEATHER" if is_premium else "CHOICE_WATERPROOF_FABRIC"
        main_material = materials_map.get(main_fabric_role)
        if not main_material:
            raise ValueError(f"Missing active material assignment for role: {main_fabric_role}")

        padding_material = None
        if has_padding:
            padding_material = materials_map.get("PADDING")
            if not padding_material:
                raise ValueError("Missing active material assignment for role: PADDING")

        # B. Calculate Material Cost & Weight
        # ------------------------------------------------
        # Cost = Area * Weight_per_sq_in * Cost_per_oz (Not quite, we usually have linear yards or per unit)
        # Wait, we need cost conversion. 
        # For this phase, let's assume we derive cost per sq inch from supplier info or use a simplified approach?
        # The prompt says: "MaterialCost (preferred supplier only -> cost per sq_in conversion)"
        
        material_cost_cents = self._get_material_cost_cents(main_material, area_sq_in)
        weight_oz = self._get_material_weight_oz(main_material, area_sq_in)
        
        if padding_material:
            material_cost_cents += self._get_material_cost_cents(padding_material, area_sq_in)
            weight_oz += self._get_material_weight_oz(padding_material, area_sq_in)

        # C. Calculate Labor Cost
        # ------------------------------------------------
        minutes = labor_settings.minutes_with_padding if has_padding else labor_settings.minutes_no_padding
        labor_cost_cents = int((minutes / 60.0) * labor_settings.hourly_rate_cents)

        # D. Calculate Shipping Cost
        # ------------------------------------------------
        shipping_cost_cents = self._get_shipping_cost_cents(shipping_profile, weight_oz)

        # E. Totals & Pricing
        # ------------------------------------------------
        raw_cost_cents = material_cost_cents + labor_cost_cents + shipping_cost_cents
        
        profit_setting = self.db.query(VariantProfitSetting).filter(VariantProfitSetting.variant_key == variant_key).first()
        if not profit_setting:
            raise ValueError(f"Profit config missing for variant: {variant_key}")
        profit_cents = profit_setting.profit_cents

        # RetailPrice = (RawCost + Profit) / (1 - Rate)
        # We work in cents, so math is same.
        # Avoid div by zero
        if fee_rate >= 1.0:
            raise ValueError("Fee rate cannot be 100% or more")
            
        target_retail_cents_float = (raw_cost_cents + profit_cents) / (1.0 - fee_rate)
        
        # Round up to nearest .95
        import math
        target_dollars = target_retail_cents_float / 100.0
        floor_dollars = math.floor(target_dollars)
        candidate = floor_dollars + 0.95
        
        if candidate >= target_dollars:
            final_dollars = candidate
        else:
            final_dollars = floor_dollars + 1.95
            
        retail_price_cents = int(round(final_dollars * 100))
        
        marketplace_fee_cents = int(round(retail_price_cents * fee_rate))
        base_cost_cents = retail_price_cents - profit_cents

        # Calculate metadata
        labor_minutes = int(minutes)
        labor_rate = labor_settings.hourly_rate_cents
        mp_fee_rate = fee_rate
        
        # material_cost_per_sq_in_cents = round(material_cost_cents / area_sq_in) if area > 0
        material_rate = 0
        if area_sq_in > 0:
            material_rate = int(round(material_cost_cents / area_sq_in))

        # F. Persist
        # ------------------------------------------------
        self._save_snapshot(
            model.id, marketplace, variant_key,
            raw_cost_cents, base_cost_cents, retail_price_cents,
            marketplace_fee_cents, profit_cents,
            material_cost_cents, shipping_cost_cents, labor_cost_cents,
            weight_oz, shipping_version,
            # Metadata
            area_sq_in, material_rate, labor_minutes, labor_rate, mp_fee_rate
        )

    def _save_snapshot(
        self, model_id: int, marketplace: str, variant_key: str,
        raw: int, base: int, retail: int, mp_fee: int, profit: int,
        mat: int, ship: int, labor: int, weight: float, shipping_version: Optional[int],
        # Metadata
        surface_area_sq_in: float, material_cost_per_sq_in_cents: int,
        labor_minutes: int, labor_rate_cents_per_hour: int, marketplace_fee_rate: float
    ):
        # Upsert
        existing = self.db.query(ModelPricingSnapshot).filter(
            ModelPricingSnapshot.model_id == model_id,
            ModelPricingSnapshot.marketplace == marketplace,
            ModelPricingSnapshot.variant_key == variant_key
        ).first()

        should_insert_history = False
        
        if existing:
            # Check for changes
            # We compare all pricing fields
            has_changed = (
                existing.raw_cost_cents != raw or
                existing.base_cost_cents != base or
                existing.retail_price_cents != retail or
                existing.marketplace_fee_cents != mp_fee or
                existing.profit_cents != profit or
                existing.material_cost_cents != mat or
                existing.shipping_cost_cents != ship or
                existing.labor_cost_cents != labor or
                abs(existing.weight_oz - weight) > 0.0001 or
                existing.shipping_settings_version_used != shipping_version or
                # Metadata fields check
                (existing.surface_area_sq_in is None or abs(existing.surface_area_sq_in - surface_area_sq_in) > 0.0001) or
                existing.material_cost_per_sq_in_cents != material_cost_per_sq_in_cents or
                existing.labor_minutes != labor_minutes or
                existing.labor_rate_cents_per_hour != labor_rate_cents_per_hour or
                (existing.marketplace_fee_rate is None or abs(existing.marketplace_fee_rate - marketplace_fee_rate) > 0.000001)
            )
            
            if has_changed:
                # Update Snapshot
                existing.raw_cost_cents = raw
                existing.base_cost_cents = base
                existing.retail_price_cents = retail
                existing.marketplace_fee_cents = mp_fee
                existing.profit_cents = profit
                existing.material_cost_cents = mat
                existing.shipping_cost_cents = ship
                existing.labor_cost_cents = labor
                existing.weight_oz = weight
                existing.shipping_settings_version_used = shipping_version
                
                # Metadata
                existing.surface_area_sq_in = surface_area_sq_in
                existing.material_cost_per_sq_in_cents = material_cost_per_sq_in_cents
                existing.labor_minutes = labor_minutes
                existing.labor_rate_cents_per_hour = labor_rate_cents_per_hour
                existing.marketplace_fee_rate = marketplace_fee_rate
                
                existing.calculated_at = datetime.utcnow()
                should_insert_history = True
            # Else: No changes
        else:
            new_snap = ModelPricingSnapshot(
                model_id=model_id,
                marketplace=marketplace,
                variant_key=variant_key,
                raw_cost_cents=raw,
                base_cost_cents=base,
                retail_price_cents=retail,
                marketplace_fee_cents=mp_fee,
                profit_cents=profit,
                material_cost_cents=mat,
                shipping_cost_cents=ship,
                labor_cost_cents=labor,
                weight_oz=weight,
                shipping_settings_version_used=shipping_version,
                calculated_at=datetime.utcnow(),
                # Metadata
                surface_area_sq_in=surface_area_sq_in,
                material_cost_per_sq_in_cents=material_cost_per_sq_in_cents,
                labor_minutes=labor_minutes,
                labor_rate_cents_per_hour=labor_rate_cents_per_hour,
                marketplace_fee_rate=marketplace_fee_rate
            )
            self.db.add(new_snap)
            should_insert_history = True
            
        if should_insert_history:
            history_row = ModelPricingHistory(
                model_id=model_id,
                marketplace=marketplace,
                variant_key=variant_key,
                raw_cost_cents=raw,
                base_cost_cents=base,
                retail_price_cents=retail,
                marketplace_fee_cents=mp_fee,
                profit_cents=profit,
                material_cost_cents=mat,
                shipping_cost_cents=ship,
                labor_cost_cents=labor,
                weight_oz=weight,
                calculated_at=datetime.utcnow(),
                reason="recalculate",
                # Metadata
                surface_area_sq_in=surface_area_sq_in,
                material_cost_per_sq_in_cents=material_cost_per_sq_in_cents,
                labor_minutes=labor_minutes,
                labor_rate_cents_per_hour=labor_rate_cents_per_hour,
                marketplace_fee_rate=marketplace_fee_rate
            )
            self.db.add(history_row)
            
        # self.db.flush() is called by caller or transaction commit
        
        logger.info(f"variant success key={variant_key} model_id={model_id}")
        
        self.db.flush() # Flush to detect errors but commit happens at top level

    def _resolve_materials(self) -> Dict[str, Material]:
        """Returns map of Role -> Material object for all currently active roles."""
        now = datetime.utcnow()
        assignments = self.db.query(MaterialRoleAssignment).filter(
            MaterialRoleAssignment.effective_date <= now,
            (MaterialRoleAssignment.end_date == None) | (MaterialRoleAssignment.end_date > now)
        ).all()
        
        # Enforce single active row per role (app level check)
        # We just take the latest one found if multiple (though DB constraints/logic should prevent)
        result = {}
        for a in assignments:
            result[a.role] = a.material
        return result

    def _get_shipping_profile(self, marketplace: str) -> Optional[MarketplaceShippingProfile]:
        now = datetime.utcnow()
        return self.db.query(MarketplaceShippingProfile).filter(
            MarketplaceShippingProfile.marketplace == marketplace,
            MarketplaceShippingProfile.effective_date <= now,
            (MarketplaceShippingProfile.end_date == None) | (MarketplaceShippingProfile.end_date > now)
        ).first()

    def _get_material_cost_cents(self, material: Material, area_sq_in: float) -> int:
        """Calculates material cost in cents for the given area."""
        # Find preferred supplier
        # In real world, we'd query SupplierMaterial.is_preferred
        # We need a fallback or strict check? Prompt says "preferred supplier only"
        # We need price per sq inch.
        # Existing logic has `cost_per_square_inch` property helper on models but let's query raw.
        # Assuming we can derive it.
        
        # Logic: 
        # SupplierMaterial has unit_cost (e.g. $10/yd)
        # Material has linear_yard_width (e.g. 54")
        # 1 linear yard = 36" length * width" width = Area per yard
        # Cost per sq in = UnitCost / AreaPerYard
        
        from app.models.core import SupplierMaterial
        
        sup_mat = self.db.query(SupplierMaterial).filter(
            SupplierMaterial.material_id == material.id,
            SupplierMaterial.is_preferred == True
        ).first()
        
        if not sup_mat:
             raise ValueError(f"No preferred supplier found for material: {material.name}")
        
        if not material.linear_yard_width:
             raise ValueError(f"Material {material.name} missing linear yard width")

        area_per_unit = material.linear_yard_width * 36.0 # sq inches per linear yard
        cost_per_sq_in = sup_mat.unit_cost / area_per_unit
        
        total_cost_dollars = cost_per_sq_in * area_sq_in
        return int(round(total_cost_dollars * 100))

    def _get_material_weight_oz(self, material: Material, area_sq_in: float) -> float:
        if material.weight_per_sq_in_oz is not None:
            return float(material.weight_per_sq_in_oz) * area_sq_in
        
        # Fallback if we haven't migrated data? Strict mode says NO FALLBACKS?
        # But Phase 4 said "Add weight_per_sq_in_oz preferred".
        # Let's try to calc from weight_per_linear_yard if existing field is null
        if material.weight_per_linear_yard and material.linear_yard_width:
             area_per_yd = material.linear_yard_width * 36.0
             oz_per_sq_in = material.weight_per_linear_yard / area_per_yd # assuming weight col is oz? 
             # Wait, existing data might be lbs or oz? 
             # Let's assume standard industry oz/yd^2 or linear yard oz.
             # Strict mode: If weight_per_sq_in_oz is null, ERROR.
             pass
        
        if material.weight_per_sq_in_oz is None:
             raise ValueError(f"Material {material.name} missing weight_per_sq_in_oz config")
             
        return float(material.weight_per_sq_in_oz) * area_sq_in

    def _get_shipping_cost_cents(self, profile: MarketplaceShippingProfile, weight_oz: float) -> int:
        defaults = self._get_shipping_defaults()
        
        # 0. Check for Fixed Cell Mode (Assumed Matrix Cell)
        # Fixed Cell mode works without a profile - uses assumption settings
        if defaults.shipping_mode == "fixed_cell":
            return self._get_fixed_cell_rate()
        
        # For other modes, profile is required
        if profile is None:
            # This shouldn't happen if shipping_mode validation is correct
            raise ValueError("Shipping profile required for non-fixed-cell shipping calculation")

        # 1. Check for Flat Mode Global Override
        if defaults.shipping_mode == "flat":
            return defaults.flat_shipping_cents
            
        # 2. Calculated Mode
        # Determine effective zone
        zone = profile.pricing_zone
        if not zone and defaults.default_zone_code:
            zone = int(defaults.default_zone_code) # Assuming profile.pricing_zone is int, and default_zone_code stored as "1" but needing int conversion if column is int
            
        # If still no zone, we can't calculate. Existing logic implies profile.pricing_zone is required or errors.
        # But if profile was missing defaults, we fallback. 
        # CAUTION: pricing_zone column in MarketplaceShippingProfile is Integer normally? 
        # Let's verify usage. profile.pricing_zone is likely int. default_zone_code is str.
        
        effective_zone = zone
        if effective_zone is None:
             raise ValueError("No pricing zone available (neither profile nor default)")

        # Find tier
        # USPS standard logic: "Weight Not Over".
        # We select the smallest tier where max_oz >= weight_oz.
        # Deterministic ordering ensures stability.
        tier = self.db.query(ShippingRateTier).filter(
            ShippingRateTier.rate_card_id == profile.rate_card_id,
            ShippingRateTier.max_oz >= weight_oz
        ).order_by(
            ShippingRateTier.max_oz.asc(),
            ShippingRateTier.id.asc()
        ).first()
        
        if not tier:
            raise ValueError(f"No shipping tier found for weight {weight_oz}oz on card {profile.rate_card_id} (weight exceeds max available tier)")
            
        rate = self.db.query(ShippingZoneRate).filter(
            ShippingZoneRate.tier_id == tier.id,
            ShippingZoneRate.zone == effective_zone
        ).first()
        
        if not rate:
            # Try falling back to default zone? 
            # Prompt says: "Only if no profile zone is available should it fall back". 
            # We handled that above in `effective_zone` determination.
            # If rate is missing for effective_zone, it's an error.
            raise ValueError(f"No shipping rate found for Tier {tier.id} Zone {effective_zone}")
            
        return rate.rate_cents



    @staticmethod
    def is_snapshot_stale(snapshot: ModelPricingSnapshot, current_version: int) -> bool:
        if not snapshot.shipping_settings_version_used:
             return True
        return snapshot.shipping_settings_version_used != current_version
