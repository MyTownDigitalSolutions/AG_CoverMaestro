from sqlalchemy.orm import Session
from app.models.core import Model, Material, MaterialColourSurcharge, PricingOption, ShippingRate
from app.models.enums import Carrier
from typing import Optional

LABOR_RATE_PER_HOUR = 15.0
WASTE_PERCENTAGE = 0.05

class PricingService:
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_area(self, width: float, depth: float, height: float) -> float:
        return 2 * (width * depth + width * height + depth * height)
    
    def calculate_area_with_waste(self, width: float, depth: float, height: float) -> tuple:
        base_area = self.calculate_area(width, depth, height)
        waste_area = base_area * (1 + WASTE_PERCENTAGE)
        return base_area, waste_area
    
    def cost_per_square_inch(self, material: Material) -> float:
        linear_yard_area = material.linear_yard_width * 36
        return material.cost_per_linear_yard / linear_yard_area
    
    def calculate_material_cost(self, material: Material, area_with_waste: float) -> float:
        cost_per_sq_inch = self.cost_per_square_inch(material)
        return cost_per_sq_inch * area_with_waste
    
    def calculate_colour_surcharge(self, material_id: int, colour: Optional[str]) -> float:
        if not colour:
            return 0.0
        surcharge = self.db.query(MaterialColourSurcharge).filter(
            MaterialColourSurcharge.material_id == material_id,
            MaterialColourSurcharge.colour == colour
        ).first()
        return surcharge.surcharge if surcharge else 0.0
    
    def calculate_labour_cost(self, material: Material) -> float:
        return (material.labor_time_minutes / 60) * LABOR_RATE_PER_HOUR
    
    def calculate_option_surcharge(
        self, 
        handle_zipper: bool, 
        two_in_one_pocket: bool, 
        music_rest_zipper: bool
    ) -> float:
        total = 0.0
        if handle_zipper:
            option = self.db.query(PricingOption).filter(PricingOption.name == "handle_zipper").first()
            if option:
                total += option.price
        if two_in_one_pocket:
            option = self.db.query(PricingOption).filter(PricingOption.name == "two_in_one_pocket").first()
            if option:
                total += option.price
        if music_rest_zipper:
            option = self.db.query(PricingOption).filter(PricingOption.name == "music_rest_zipper").first()
            if option:
                total += option.price
        return total
    
    def calculate_weight(self, material: Material, area_with_waste: float) -> float:
        linear_yard_area = material.linear_yard_width * 36
        weight_per_sq_inch = material.weight_per_linear_yard / linear_yard_area
        return weight_per_sq_inch * area_with_waste
    
    def lookup_shipping_rate(
        self, 
        weight: float, 
        carrier: Carrier = Carrier.USPS, 
        zone: str = "1"
    ) -> float:
        rate = self.db.query(ShippingRate).filter(
            ShippingRate.carrier == carrier,
            ShippingRate.zone == zone,
            ShippingRate.min_weight <= weight,
            ShippingRate.max_weight >= weight
        ).first()
        if rate:
            return rate.rate + rate.surcharge
        highest_rate = self.db.query(ShippingRate).filter(
            ShippingRate.carrier == carrier,
            ShippingRate.zone == zone
        ).order_by(ShippingRate.max_weight.desc()).first()
        if highest_rate:
            return highest_rate.rate + highest_rate.surcharge
        return 10.0
    
    def calculate_total(
        self,
        model_id: int,
        material_id: int,
        colour: Optional[str] = None,
        quantity: int = 1,
        handle_zipper: bool = False,
        two_in_one_pocket: bool = False,
        music_rest_zipper: bool = False,
        carrier: Carrier = Carrier.USPS,
        zone: str = "1"
    ) -> dict:
        model = self.db.query(Model).filter(Model.id == model_id).first()
        material = self.db.query(Material).filter(Material.id == material_id).first()
        
        if not model or not material:
            raise ValueError("Model or Material not found")
        
        area, waste_area = self.calculate_area_with_waste(model.width, model.depth, model.height)
        material_cost = self.calculate_material_cost(material, waste_area)
        colour_surcharge = self.calculate_colour_surcharge(material_id, colour)
        labour_cost = self.calculate_labour_cost(material)
        option_surcharge = self.calculate_option_surcharge(handle_zipper, two_in_one_pocket, music_rest_zipper)
        weight = self.calculate_weight(material, waste_area)
        shipping_cost = self.lookup_shipping_rate(weight * quantity, carrier, zone)
        
        unit_total = material_cost + colour_surcharge + labour_cost + option_surcharge
        total = (unit_total * quantity) + shipping_cost
        
        return {
            "area": round(area, 2),
            "waste_area": round(waste_area, 2),
            "material_cost": round(material_cost, 2),
            "colour_surcharge": round(colour_surcharge, 2),
            "labour_cost": round(labour_cost, 2),
            "option_surcharge": round(option_surcharge, 2),
            "weight": round(weight, 2),
            "shipping_cost": round(shipping_cost, 2),
            "unit_total": round(unit_total, 2),
            "total": round(total, 2)
        }
