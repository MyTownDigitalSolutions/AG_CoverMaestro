export interface Manufacturer {
  id: number
  name: string
}

export interface Series {
  id: number
  name: string
  manufacturer_id: number
}

export interface AmazonCustomizationTemplate {
  id: number
  original_filename: string
  file_path?: string
  upload_date: string
  file_size: number
}

export interface ReverbTemplateReference {
  id: number
  original_filename: string
  // Add other fields if needed, but this suffices for assignment UI
}

export interface EquipmentTypeCustomizationTemplateItem {
  template_id: number
  slot: number
  original_filename: string
  upload_date: string
}

export interface EquipmentTypeCustomizationTemplatesResponse {
  equipment_type_id: number
  templates: EquipmentTypeCustomizationTemplateItem[]
  default_template_id: number | null
}

export interface EquipmentType {
  id: number
  name: string
  amazon_customization_template_id?: number | null
  amazon_customization_template?: AmazonCustomizationTemplate | null
  reverb_template_id?: number | null
  reverb_template?: ReverbTemplateReference | null
}

export interface DesignOption {
  id: number
  name: string
  description?: string
  option_type: string
  is_pricing_relevant: boolean
  equipment_type_ids?: number[]
  sku_abbreviation?: string
  ebay_variation_enabled?: boolean
}

export interface MarketplaceListing {
  id: number
  model_id: number
  marketplace: string
  external_id: string
  listing_url?: string
  status?: string
  parent_external_id?: string
  created_at: string
  updated_at: string
}

export interface AmazonAPlusContent {
  id: number
  model_id: number
  content_type: string
  is_uploaded: boolean
  notes?: string
  created_at: string
  updated_at: string
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
  sku_override?: string
  surface_area_sq_in?: number
  top_depth_in?: number
  angle_drop_in?: number
  handle_location_option_id?: number | null
  angle_type_option_id?: number | null
  top_handle_length_in?: number | null
  top_handle_height_in?: number | null
  top_handle_rear_edge_to_center_in?: number | null
  model_notes?: string | null
  exclude_from_amazon_export?: boolean
  exclude_from_ebay_export?: boolean
  exclude_from_reverb_export?: boolean
  exclude_from_etsy_export?: boolean
  marketplace_listings?: MarketplaceListing[]
  amazon_a_plus_content?: AmazonAPlusContent[]
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
  cost_per_linear_yard?: number
  sku_abbreviation?: string
  ebay_variation_enabled?: boolean
}

export interface MaterialColourSurcharge {
  id: number
  material_id: number
  colour: string
  surcharge: number
  color_friendly_name?: string
  sku_abbreviation?: string
  ebay_variation_enabled?: boolean
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
  first_name?: string
  last_name?: string
  buyer_email?: string
  marketplace_buyer_email?: string
  phone?: string
  mobile_phone?: string
  work_phone?: string
  other_phone?: string
  address?: string  // Legacy field
  // Billing
  billing_address1?: string
  billing_address2?: string
  billing_city?: string
  billing_state?: string
  billing_postal_code?: string
  billing_country?: string
  // Shipping
  shipping_name?: string
  shipping_address1?: string
  shipping_address2?: string
  shipping_city?: string
  shipping_state?: string
  shipping_postal_code?: string
  shipping_country?: string
  // Marketplace identity
  source_marketplace?: string
  source_customer_id?: string
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
  sku_abbreviation?: string
  ebay_variation_enabled?: boolean
  linked_design_option_id?: number | null
  linked_design_option?: {
    id: number
    name: string
    sku_abbreviation?: string
    ebay_variation_enabled?: boolean
  } | null
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
  original_filename?: string
  file_path?: string
  upload_date?: string
  file_size?: number
  export_sheet_name_override?: string | null
  export_start_row_override?: number | null
  export_force_exact_start_row?: boolean
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

export interface MaterialRoleConfig {
  id: number
  role: string
  display_name: string | null
  sku_abbrev_no_padding: string | null
  sku_abbrev_with_padding: string | null
  ebay_variation_enabled: boolean
}

export interface ShippingZone {
  id: number
  code: string
  name: string
  sort_order?: number
  active: boolean
}

export interface ShippingRateCard {
  id: number
  carrier: string
  name: string
  effective_date: string
  end_date?: string
  active: boolean
}

export interface ShippingRateTier {
  id: number
  rate_card_id: number
  min_oz: number
  max_oz: number
  label?: string
  active: boolean
}

export interface ShippingZoneRate {
  id: number
  tier_id: number
  zone: number
  rate_cents: number
}

export interface ShippingZoneRateNormalized {
  zone_id: number
  zone_code: string
  zone_name: string
  rate_cents: number | null
  zone_rate_id: number | null
}

export interface MarketplaceShippingProfile {
  id: number
  marketplace: string
  rate_card_id: number
  pricing_zone: number
  effective_date: string
  end_date?: string
}

export interface ShippingDefaultSettingResponse {
  id: number
  shipping_mode: 'calculated' | 'flat' | 'fixed_cell'
  flat_shipping_cents: number
  default_rate_card_id: number | null
  default_zone_code: string | null
  assumed_rate_card_id: number | null
  assumed_tier_id: number | null
  assumed_zone_code: string | null
  shipping_settings_version: number
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

  // Metadata
  surface_area_sq_in?: number
  material_cost_per_sq_in_cents?: number
  labor_minutes?: number
  labor_rate_cents_per_hour?: number
  marketplace_fee_rate?: number
}

export interface ModelPricingHistory {
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
  reason?: string

  // Metadata
  surface_area_sq_in?: number
  material_cost_per_sq_in_cents?: number
  labor_minutes?: number
  labor_rate_cents_per_hour?: number
  marketplace_fee_rate?: number
}

export interface PricingDiffResponse {
  old_version_date: string
  new_version_date: string
  diffs: {
    field_name: string
    old_value: any
    new_value: any
    delta: any
    direction: 'increase' | 'decrease' | 'change' | 'none'
  }[]
}

export interface PricingRecalculateBulkRequest {
  marketplaces?: string[]
  scope: 'manufacturer' | 'series' | 'models'
  manufacturer_id?: number
  series_id?: number
  model_ids?: number[]
  variant_set?: string
  dry_run?: boolean
}

export interface PricingRecalculateResult {
  model_id: number
  error?: string
}

export interface PricingRecalculateBulkResponse {
  marketplaces: string[]
  scope: string
  resolved_model_count: number
  results: Record<string, {
    succeeded: number[]
    failed: PricingRecalculateResult[]
  }>
}

export interface ExportSetting {
  id: number
  default_save_path_template?: string
}


