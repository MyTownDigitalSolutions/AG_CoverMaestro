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
  uses_handle_options: boolean
  uses_angle_options: boolean
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
}

export interface Material {
  id: number
  name: string
  base_color: string
  linear_yard_width: number
  cost_per_linear_yard: number
  weight_per_linear_yard: number
  labor_time_minutes: number
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
  labour_cost: number
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
