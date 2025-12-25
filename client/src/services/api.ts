import axios from 'axios'
import type {
  Manufacturer, Series, EquipmentType, Model, Material,
  Customer, Order, PricingOption, PricingResult, AmazonProductType,
  EnumValue, ProductTypeField, ProductTypeFieldValue, DesignOption,
  Supplier, SupplierMaterial, SupplierMaterialWithSupplier, SupplierMaterialWithMaterial,
  MaterialRoleAssignment, ShippingRateCard, ShippingRateTier, ShippingZoneRate,
  MarketplaceShippingProfile, LaborSetting, MarketplaceFeeRate, VariantProfitSetting, ModelPricingSnapshot,
  ModelPricingHistory, PricingDiffResponse, ShippingZone, ShippingZoneRateNormalized,
  ShippingDefaultSettingResponse
} from '../types'

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

const api = axios.create({
  baseURL: '/api',
})

export const manufacturersApi = {
  list: () => api.get<Manufacturer[]>('/manufacturers').then(r => r.data),
  get: (id: number) => api.get<Manufacturer>(`/manufacturers/${id}`).then(r => r.data),
  create: (data: { name: string }) => api.post<Manufacturer>('/manufacturers', data).then(r => r.data),
  update: (id: number, data: { name: string }) => api.put<Manufacturer>(`/manufacturers/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/manufacturers/${id}`),
}

export const seriesApi = {
  list: (manufacturerId?: number) =>
    api.get<Series[]>('/series', { params: { manufacturer_id: manufacturerId } }).then(r => r.data),
  create: (data: { name: string; manufacturer_id: number }) =>
    api.post<Series>('/series', data).then(r => r.data),
  update: (id: number, data: { name: string; manufacturer_id: number }) =>
    api.put<Series>(`/series/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/series/${id}`),
}

export const equipmentTypesApi = {
  list: () => api.get<EquipmentType[]>('/equipment-types').then(r => r.data),
  get: (id: number) => api.get<EquipmentType>(`/equipment-types/${id}`).then(r => r.data),
  create: (data: Partial<EquipmentType>) => api.post<EquipmentType>('/equipment-types', data).then(r => r.data),
  update: (id: number, data: Partial<EquipmentType>) => api.put<EquipmentType>(`/equipment-types/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/equipment-types/${id}`),

  getPricingOptions: (id: number) =>
    api.get<PricingOption[]>(`/equipment-types/${id}/pricing-options`).then(r => r.data),

  setPricingOptions: (id: number, pricingOptionIds: number[]) =>
    api.put(`/equipment-types/${id}/pricing-options`, { pricing_option_ids: pricingOptionIds }).then(r => r.data),

  getDesignOptions: (id: number) =>
    api.get<DesignOption[]>(`/equipment-types/${id}/design-options`).then(r => r.data),

  setDesignOptions: (id: number, designOptionIds: number[]) =>
    api.put(`/equipment-types/${id}/design-options`, { design_option_ids: designOptionIds }).then(r => r.data),
}

export const designOptionsApi = {
  list: () => api.get<DesignOption[]>('/design-options').then(r => r.data),
  get: (id: number) => api.get<DesignOption>(`/design-options/${id}`).then(r => r.data),
  create: (data: { name: string; description?: string }) => api.post<DesignOption>('/design-options', data).then(r => r.data),
  update: (id: number, data: { name: string; description?: string }) => api.put<DesignOption>(`/design-options/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/design-options/${id}`),
}

export const modelsApi = {
  list: (seriesId?: number) => api.get<Model[]>('/models', { params: { series_id: seriesId } }).then(r => r.data),
  get: (id: number) => api.get<Model>(`/models/${id}`).then(r => r.data),
  create: (data: Partial<Model>) => api.post<Model>('/models', data).then(r => r.data),
  update: (id: number, data: Partial<Model>) => api.put<Model>(`/models/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/models/${id}`),

  getPricing: (id: number, marketplace: string = "DEFAULT") =>
    api.get<ModelPricingSnapshot[]>(`/models/${id}/pricing`, { params: { marketplace } }).then(r => r.data),

  recalculatePricing: (id: number, marketplace: string) =>
    api.post<ModelPricingSnapshot[]>(`/models/${id}/pricing/recalculate`, null, { params: { marketplace } }).then(r => r.data),

  getDebugPrice: (id: number) =>
    api.get<ModelPricingSnapshot>(`/export/debug-price/${id}`).then(r => r.data),

  getBaselineSnapshots: (id: number, marketplace: string = "amazon") =>
    api.get<ModelPricingSnapshot[]>(`/models/${id}/pricing/snapshots`, { params: { marketplace } }).then(r => r.data),

  getPricingHistory: (id: number, marketplace: string, variant_key: string) =>
    api.get<ModelPricingHistory[]>(`/models/${id}/pricing/history`, { params: { marketplace, variant_key } }).then(r => r.data),

  getPricingDiff: (id: number, marketplace: string, variant_key: string) =>
    api.get<PricingDiffResponse>(`/models/${id}/pricing/diff`, { params: { marketplace, variant_key } }).then(r => r.data),
}

export const materialsApi = {
  list: () => api.get<Material[]>('/materials').then(r => r.data),
  get: (id: number) => api.get<Material>(`/materials/${id}`).then(r => r.data),
  create: (data: Partial<Material>) => api.post<Material>('/materials', data).then(r => r.data),
  update: (id: number, data: Partial<Material>) => api.put<Material>(`/materials/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/materials/${id}`),
  getSuppliers: (id: number) => api.get<SupplierMaterialWithSupplier[]>(`/materials/${id}/suppliers`).then(r => r.data),
  setPreferredSupplier: (materialId: number, supplierId: number) =>
    api.patch(`/materials/${materialId}/set-preferred-supplier`, { supplier_id: supplierId }).then(r => r.data),
  getPreferredSupplier: (id: number) =>
    api.get<{ preferred_supplier: string | null; supplier_id?: number; unit_cost: number | null }>(`/materials/${id}/preferred-supplier`).then(r => r.data),
}

export const suppliersApi = {
  list: () => api.get<Supplier[]>('/suppliers').then(r => r.data),
  get: (id: number) => api.get<Supplier>(`/suppliers/${id}`).then(r => r.data),
  create: (data: Partial<Supplier>) => api.post<Supplier>('/suppliers', data).then(r => r.data),
  update: (id: number, data: Partial<Supplier>) => api.put<Supplier>(`/suppliers/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/suppliers/${id}`),
  getMaterials: (id: number) => api.get<SupplierMaterialWithMaterial[]>(`/suppliers/${id}/materials`).then(r => r.data),
  createMaterialLink: (data: { supplier_id: number; material_id: number; unit_cost: number; shipping_cost: number; quantity_purchased?: number; is_preferred?: boolean }) =>
    api.post<SupplierMaterial>('/suppliers/materials', data).then(r => r.data),
  updateMaterialLink: (id: number, data: { supplier_id: number; material_id: number; unit_cost: number; shipping_cost: number; quantity_purchased?: number; is_preferred?: boolean }) =>
    api.put<SupplierMaterial>(`/suppliers/materials/${id}`, data).then(r => r.data),
  deleteMaterialLink: (id: number) => api.delete(`/suppliers/materials/${id}`),
}

export const customersApi = {
  list: () => api.get<Customer[]>('/customers').then(r => r.data),
  get: (id: number) => api.get<Customer>(`/customers/${id}`).then(r => r.data),
  create: (data: Partial<Customer>) => api.post<Customer>('/customers', data).then(r => r.data),
  update: (id: number, data: Partial<Customer>) => api.put<Customer>(`/customers/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/customers/${id}`),
}

export const ordersApi = {
  list: () => api.get<Order[]>('/orders').then(r => r.data),
  get: (id: number) => api.get<Order>(`/orders/${id}`).then(r => r.data),
  create: (data: Partial<Order>) => api.post<Order>('/orders', data).then(r => r.data),
  delete: (id: number) => api.delete(`/orders/${id}`),
}

export interface RecalcRequest {
  all?: boolean
  manufacturer_id?: number
  series_id?: number
  model_ids?: number[]
  only_if_stale?: boolean
}

export interface RecalcResponse {
  evaluated_models: number
  recalculated_models: number
  skipped_not_stale: number
}

export const pricingApi = {
  calculate: (data: {
    model_id: number
    material_id: number
    colour?: string
    quantity?: number
    handle_zipper?: boolean
    two_in_one_pocket?: boolean
    music_rest_zipper?: boolean
    carrier?: string
    zone?: string
  }) => api.post<PricingResult>('/pricing/calculate', data).then(r => r.data),
  listOptions: () => api.get<PricingOption[]>('/pricing/options').then(r => r.data),
  getOption: (id: number) => api.get<PricingOption>(`/pricing/options/${id}`).then(r => r.data),
  createOption: (data: { name: string; price: number }) => api.post<PricingOption>('/pricing/options', data).then(r => r.data),
  updateOption: (id: number, data: { name: string; price: number }) => api.put<PricingOption>(`/pricing/options/${id}`, data).then(r => r.data),
  deleteOption: (id: number) => api.delete(`/pricing/options/${id}`),
  getOptionsByEquipmentType: (equipmentTypeId: number) =>
    api.get<PricingOption[]>(`/pricing/options/by-equipment-type/${equipmentTypeId}`).then(r => r.data),
  recalculateBulk: (data: PricingRecalculateBulkRequest) =>
    api.post<PricingRecalculateBulkResponse>('/pricing/recalculate/bulk', data).then(r => r.data),
  recalculateBaselines: (data: RecalcRequest) =>
    api.post<RecalcResponse>('/pricing/recalculate', data).then(r => r.data),
}

export interface EquipmentTypeProductTypeLink {
  id: number
  equipment_type_id: number
  product_type_id: number
}

export const templatesApi = {
  list: () => api.get<AmazonProductType[]>('/templates').then(r => r.data),
  get: (code: string) => api.get<AmazonProductType>(`/templates/${code}`).then(r => r.data),
  import: (file: File, productCode: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('product_code', productCode)
    return api.post('/templates/import', formData).then(r => r.data)
  },
  delete: (code: string) => api.delete(`/templates/${code}`),
  listEquipmentTypeLinks: () => api.get<EquipmentTypeProductTypeLink[]>('/templates/equipment-type-links').then(r => r.data),
  createEquipmentTypeLink: (equipmentTypeId: number, productTypeId: number) =>
    api.post<EquipmentTypeProductTypeLink>('/templates/equipment-type-links', { equipment_type_id: equipmentTypeId, product_type_id: productTypeId }).then(r => r.data),
  deleteEquipmentTypeLink: (linkId: number) => api.delete(`/templates/equipment-type-links/${linkId}`),
  updateField: (fieldId: number, data: { required?: boolean; selected_value?: string }) =>
    api.patch<ProductTypeField>(`/templates/fields/${fieldId}`, data).then(r => r.data),
  addFieldValue: (fieldId: number, value: string) =>
    api.post<ProductTypeFieldValue>(`/templates/fields/${fieldId}/values`, { value }).then(r => r.data),
  deleteFieldValue: (fieldId: number, valueId: number) =>
    api.delete(`/templates/fields/${fieldId}/values/${valueId}`),
}

export const enumsApi = {
  handleLocations: () => api.get<EnumValue[]>('/enums/handle-locations').then(r => r.data),
  angleTypes: () => api.get<EnumValue[]>('/enums/angle-types').then(r => r.data),
  carriers: () => api.get<EnumValue[]>('/enums/carriers').then(r => r.data),
  marketplaces: () => api.get<EnumValue[]>('/enums/marketplaces').then(r => r.data),
}

export const settingsApi = {
  // Material Roles
  listMaterialRoles: (includeHistory = false) =>
    api.get<MaterialRoleAssignment[]>('/settings/material-roles', { params: { include_history: includeHistory } }).then(r => r.data),
  assignMaterialRole: (data: { role: string; material_id: number; effective_date?: string }) =>
    api.post<MaterialRoleAssignment>('/settings/material-roles/assign', data).then(r => r.data),

  // Shipping
  listZones: () => api.get<ShippingZone[]>('/settings/shipping/zones').then(r => r.data),
  listRateCards: (includeInactive = false) => api.get<ShippingRateCard[]>('/settings/shipping/rate-cards', { params: { include_inactive: includeInactive } }).then(r => r.data),
  createRateCard: (data: { name: string; carrier?: string }) => api.post<ShippingRateCard>('/settings/shipping/rate-cards', data).then(r => r.data),
  updateRateCard: (id: number, data: { name?: string; active?: boolean }) => api.put<ShippingRateCard>(`/settings/shipping/rate-cards/${id}`, data).then(r => r.data),
  deleteRateCard: (id: number) => api.delete(`/settings/shipping/rate-cards/${id}`),

  listTiers: (cardId: number, includeInactive = false) => api.get<ShippingRateTier[]>(`/settings/shipping/rate-cards/${cardId}/tiers`, { params: { include_inactive: includeInactive } }).then(r => r.data),
  createTier: (cardId: number, data: { label?: string; max_weight_oz: number; min_oz?: number }) => api.post<ShippingRateTier>(`/settings/shipping/rate-cards/${cardId}/tiers`, data).then(r => r.data),
  updateTier: (tierId: number, data: { label?: string; max_weight_oz?: number; active?: boolean }) => api.put<ShippingRateTier>(`/settings/shipping/tiers/${tierId}`, data).then(r => r.data),
  deleteTier: (tierId: number) => api.delete(`/settings/shipping/tiers/${tierId}`),

  listZoneRates: (tierId: number) => api.get<ShippingZoneRateNormalized[]>(`/settings/shipping/tiers/${tierId}/zone-rates`).then(r => r.data),
  createZoneRate: (data: Partial<ShippingZoneRate>) => api.post<ShippingZoneRate>('/settings/shipping/zone-rates', data).then(r => r.data),

  upsertTierZoneRate: (tierId: number, zoneId: number, rateCents: number | null) =>
    api.put<ShippingZoneRateNormalized>(`/settings/shipping/tiers/${tierId}/zone-rates/${zoneId}`, { rate_cents: rateCents }).then(r => r.data),

  listProfiles: (includeHistory = false) =>
    api.get<MarketplaceShippingProfile[]>('/settings/shipping/marketplace-profiles', { params: { include_history: includeHistory } }).then(r => r.data),
  assignProfile: (data: { marketplace: string; rate_card_id: number; pricing_zone: number; effective_date?: string }) =>
    api.post<MarketplaceShippingProfile>('/settings/shipping/marketplace-profiles/assign', data).then(r => r.data),

  getShippingDefaults: () => api.get<ShippingDefaultSettingResponse>('/settings/shipping/defaults').then(r => r.data),
  updateShippingDefaults: (data: Partial<ShippingDefaultSettingResponse>) =>
    api.put<ShippingDefaultSettingResponse>('/settings/shipping/defaults', data).then(r => r.data),

  // Configs
  getLabor: () => api.get<LaborSetting>('/settings/labor').then(r => r.data),
  updateLabor: (data: LaborSetting) => api.put<LaborSetting>('/settings/labor', data).then(r => r.data),

  listFees: () => api.get<MarketplaceFeeRate[]>('/settings/marketplace-fees').then(r => r.data),
  updateFee: (data: MarketplaceFeeRate) => api.put<MarketplaceFeeRate>('/settings/marketplace-fees', data).then(r => r.data),

  listProfits: () => api.get<VariantProfitSetting[]>('/settings/profits').then(r => r.data),
  updateProfit: (data: VariantProfitSetting) => api.put<VariantProfitSetting>('/settings/profits', data).then(r => r.data),
}

export interface ExportRowData {
  model_id: number
  model_name: string
  data: (string | null)[]
}

export interface ExportPreviewResponse {
  headers: (string | null)[][]
  rows: ExportRowData[]
  template_code: string
}

export const exportApi = {
  generatePreview: (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') =>
    api.post<ExportPreviewResponse>('/export/preview', { model_ids: modelIds, listing_type: listingType }).then(r => r.data),

  downloadXlsx: async (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') => {
    const response = await api.post('/export/download/xlsx', { model_ids: modelIds, listing_type: listingType }, { responseType: 'blob' })
    return response
  },

  downloadXlsm: async (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') => {
    const response = await api.post('/export/download/xlsm', { model_ids: modelIds, listing_type: listingType }, { responseType: 'blob' })
    return response
  },

  downloadCsv: async (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') => {
    const response = await api.post('/export/download/csv', { model_ids: modelIds, listing_type: listingType }, { responseType: 'blob' })
    return response
  },
}

export default api
