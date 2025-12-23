from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, List, Dict
from app.models.core import (
    Model, Material, MaterialRoleAssignment, MarketplaceShippingProfile,
    ShippingRateCard, ShippingRateTier, ShippingZoneRate, LaborSetting,
    VariantProfitSetting, MarketplaceFeeRate, ModelPricingSnapshot
)
from app.models.enums import Marketplace

# Constants
WASTE_PERCENTAGE = 0.05

class PricingCalculator:
    def __init__(self, db: Session):
        self.db = db

    def calculate_model_prices(self, model_id: int, marketplace: str = "DEFAULT"):
        """
        Calculate and persist pricing snapshots for all 4 variants of a model for a specific marketplace.
        """
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
        if not shipping_profile:
             raise ValueError(f"Shipping profile not configured for marketplace: {marketplace}")

        # 2. Resolve Materials (As of Now)
        # ----------------------------------------------------
        materials_map = self._resolve_materials()
        
        # 3. Calculate Area
        # ----------------------------------------------------
        # Use stored surface area if available, else calc on fly (but model should have it now)
        if model.surface_area_sq_in:
             area_sq_in = model.surface_area_sq_in
        else:
             # Fallback calculation (should be rare with new logic)
             base = 2 * (model.width * model.depth + model.width * model.height + model.depth * model.height)
             area_sq_in = base * (1 + WASTE_PERCENTAGE)

        # 4. Iterate Variants and Calculate
        # ----------------------------------------------------
        variants = [
            "choice_no_padding", "choice_with_padding",
            "premium_no_padding", "premium_with_padding"
        ]
        
        for variant_key in variants:
            self._calculate_single_variant(
                model, variant_key, marketplace, area_sq_in,
                materials_map, labor_settings, fee_rate, shipping_profile
            )

    def _calculate_single_variant(
        self, model: Model, variant_key: str, marketplace: str, area_sq_in: float,
        materials_map: Dict[str, Material], labor_settings: LaborSetting, 
        fee_rate: float, shipping_profile: MarketplaceShippingProfile
    ):
        # A. Determine Components based on variant key
        # ------------------------------------------------
        is_premium = "premium" in variant_key
        has_padding = "padding" in variant_key and "no_padding" not in variant_key # careful with naming

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

        # F. Persist
        # ------------------------------------------------
        self._save_snapshot(
            model.id, marketplace, variant_key,
            raw_cost_cents, base_cost_cents, retail_price_cents,
            marketplace_fee_cents, profit_cents,
            material_cost_cents, shipping_cost_cents, labor_cost_cents,
            weight_oz
        )

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
        # Find tier
        # min <= weight < max
        tier = self.db.query(ShippingRateTier).filter(
            ShippingRateTier.rate_card_id == profile.rate_card_id,
            ShippingRateTier.min_oz <= weight_oz,
            ShippingRateTier.max_oz > weight_oz
        ).first()
        
        if not tier:
            raise ValueError(f"No shipping tier found for weight {weight_oz}oz on card {profile.rate_card_id}")
            
        rate = self.db.query(ShippingZoneRate).filter(
            ShippingZoneRate.tier_id == tier.id,
            ShippingZoneRate.zone == profile.pricing_zone
        ).first()
        
        if not rate:
            raise ValueError(f"No shipping rate found for Tier {tier.id} Zone {profile.pricing_zone}")
            
        return rate.rate_cents

    def _save_snapshot(
        self, model_id, marketplace, variant_key,
        raw, base, retail, mp_fee, profit, mat, ship, labor, weight
    ):
        # Upsert
        existing = self.db.query(ModelPricingSnapshot).filter(
            ModelPricingSnapshot.model_id == model_id,
            ModelPricingSnapshot.marketplace == marketplace,
            ModelPricingSnapshot.variant_key == variant_key
        ).first()
        
        if existing:
            existing.raw_cost_cents = raw
            existing.base_cost_cents = base
            existing.retail_price_cents = retail
            existing.marketplace_fee_cents = mp_fee
            existing.profit_cents = profit
            existing.material_cost_cents = mat
            existing.shipping_cost_cents = ship
            existing.labor_cost_cents = labor
            existing.weight_oz = weight
            existing.calculated_at = datetime.utcnow()
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
                weight_oz=weight
            )
            self.db.add(new_snap)
        
        self.db.flush() # Flush to detect errors but commit happens at top level
