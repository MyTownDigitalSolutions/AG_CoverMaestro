export interface Manufacturer {
  id: number
  name: string
}

export interface Series {
  id: number
  name: string
  manufacturer_id: number
}

export interface EquipmentType {
  id: number
  name: string
}

export interface DesignOption {
  id: number
  name: string
  description?: string
}

export interface Model {
  id: number
  name: string
  series_id: number
  equipment_type_id: number
  width: number
  depth: number
  height: number
  handle_length?: number
  handle_width?: number
  handle_location: string
  angle_type: string
  image_url?: string
  parent_sku?: string
  surface_area_sq_in?: number
}

export type MaterialType = 'fabric' | 'hardware' | 'packaging'
export type UnitOfMeasure = 'yard' | 'each' | 'package' | 'box' | 'set'

export interface Material {
  id: number
  name: string
  base_color: string
  material_type: MaterialType
  linear_yard_width?: number
  weight_per_linear_yard?: number
  unit_of_measure?: UnitOfMeasure
  package_quantity?: number
}

export interface MaterialColourSurcharge {
  id: number
  material_id: number
  colour: string
  surcharge: number
}

export interface Supplier {
  id: number
  name: string
  contact_name?: string
  address?: string
  phone?: string
  email?: string
  website?: string
}

export interface SupplierMaterial {
  id: number
  supplier_id: number
  material_id: number
  unit_cost: number
  shipping_cost: number
  quantity_purchased: number
  is_preferred: boolean
}

export interface SupplierMaterialWithSupplier extends SupplierMaterial {
  supplier_name: string
  material_type?: MaterialType
  cost_per_linear_yard: number
  cost_per_square_inch: number
}

export interface SupplierMaterialWithMaterial extends SupplierMaterial {
  material_name: string
  material_type?: MaterialType
  linear_yard_width?: number
  cost_per_linear_yard: number
  cost_per_square_inch: number
}

export interface Customer {
  id: number
  name: string
  address?: string
  phone?: string
}

export interface OrderLine {
  id: number
  order_id: number
  model_id: number
  material_id: number
  colour?: string
  quantity: number
  handle_zipper: boolean
  two_in_one_pocket: boolean
  music_rest_zipper: boolean
  unit_price?: number
}

export interface Order {
  id: number
  customer_id: number
  marketplace?: string
  marketplace_order_number?: string
  order_date: string
  order_lines: OrderLine[]
}

export interface PricingOption {
  id: number
  name: string
  price: number
}

export interface PricingResult {
  area: number
  waste_area: number
  material_cost: number
  colour_surcharge: number
  option_surcharge: number
  weight: number
  shipping_cost: number
  unit_total: number
  total: number
}

export interface ProductTypeFieldValue {
  id: number
  value: string
}

export interface ProductTypeField {
  id: number
  field_name: string
  display_name?: string
  attribute_group?: string
  required: boolean
  order_index: number
  description?: string
  selected_value?: string
  custom_value?: string
  valid_values: ProductTypeFieldValue[]
}

export interface AmazonProductType {
  id: number
  code: string
  name?: string
  description?: string
  header_rows?: (string | null)[][]
  keywords: { id: number; keyword: string }[]
  fields: ProductTypeField[]
}

export interface EnumValue {
  value: string
  name: string
}

// Settings Types
export interface MaterialRoleAssignment {
  id: number
  role: string
  material_id: number
  effective_date: string
  end_date?: string
  created_at: string
}

export interface ShippingRateCard {
  id: number
  carrier: string
  name: string
  effective_date: string
  end_date?: string
}

export interface ShippingRateTier {
  id: number
  rate_card_id: number
  min_oz: number
  max_oz: number
  label?: string
}

export interface ShippingZoneRate {
  id: number
  tier_id: number
  zone: number
  rate_cents: number
}

export interface MarketplaceShippingProfile {
  id: number
  marketplace: string
  rate_card_id: number
  pricing_zone: number
  effective_date: string
  end_date?: string
}

export interface LaborSetting {
  id: number
  hourly_rate_cents: number
  minutes_no_padding: number
  minutes_with_padding: number
}

export interface MarketplaceFeeRate {
  marketplace: string
  fee_rate: number
}

export interface VariantProfitSetting {
  variant_key: string
  profit_cents: number
}

export interface ModelPricingSnapshot {
  id: number
  model_id: number
  marketplace: string
  variant_key: string
  raw_cost_cents: number
  base_cost_cents: number
  retail_price_cents: number
  marketplace_fee_cents: number
  profit_cents: number
  material_cost_cents: number
  shipping_cost_cents: number
  labor_cost_cents: number
  weight_oz: number
  calculated_at: string
}
