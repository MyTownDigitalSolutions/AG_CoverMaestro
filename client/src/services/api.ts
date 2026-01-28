import axios from 'axios'
import type {
  Manufacturer, Series, EquipmentType, Model, Material, MaterialColourSurcharge,
  Customer, Order, PricingOption, PricingResult, AmazonProductType,
  EnumValue, ProductTypeField, ProductTypeFieldValue, DesignOption,
  Supplier, SupplierMaterial, SupplierMaterialWithSupplier, SupplierMaterialWithMaterial,
  MaterialRoleAssignment, MaterialRoleConfig, ShippingRateCard, ShippingRateTier, ShippingZoneRate,
  MarketplaceShippingProfile, LaborSetting, MarketplaceFeeRate, VariantProfitSetting, ModelPricingSnapshot,
  ModelPricingHistory, PricingDiffResponse, ShippingZone, ShippingZoneRateNormalized,
  ShippingDefaultSettingResponse, AmazonCustomizationTemplate, EquipmentTypeCustomizationTemplatesResponse
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
  create: (data: { name: string; description?: string; option_type: string; is_pricing_relevant?: boolean; equipment_type_ids?: number[] }) => api.post<DesignOption>('/design-options', data).then(r => r.data),
  update: (id: number, data: { name: string; description?: string; option_type: string; is_pricing_relevant?: boolean; equipment_type_ids?: number[] }) => api.put<DesignOption>(`/design-options/${id}`, data).then(r => r.data),
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

  recalculateBaselines: (data: { all?: boolean; manufacturer_id?: number; series_id?: number; model_ids?: number[]; only_if_stale?: boolean }) => api.post('/pricing/recalculate', data).then(r => r.data),

  verifySnapshotStatus: (modelIds: number[]) => api.post<{ missing_snapshots: Record<number, string[]>; complete: boolean }>('/pricing/snapshots/status', { model_ids: modelIds }).then(r => r.data),

  recalculateBulk: (data: { scope: 'manufacturer' | 'series' | 'models'; manufacturer_id?: number; series_id?: number; model_ids?: number[]; marketplaces?: string[]; dry_run?: boolean }) => api.post('/pricing/recalculate/bulk', data).then(r => r.data),
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
  listSurcharges: (id: number) => api.get<MaterialColourSurcharge[]>(`/materials/${id}/surcharges`).then(r => r.data),
  createSurcharge: (data: Omit<MaterialColourSurcharge, 'id'>) => api.post<MaterialColourSurcharge>('/materials/surcharges', data).then(r => r.data),
  updateSurcharge: (id: number, data: Omit<MaterialColourSurcharge, 'id' | 'material_id'>) => api.put<MaterialColourSurcharge>(`/materials/surcharges/${id}`, { material_id: 0, ...data }).then(r => r.data), // material_id ignored by backend but required by schema
  deleteSurcharge: (id: number) => api.delete(`/materials/surcharges/${id}`),
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
  verifySnapshotStatus: (modelIds: number[]) => api.post<{ missing_snapshots: Record<number, string[]>; complete: boolean }>('/pricing/snapshots/status', { model_ids: modelIds }).then(r => r.data),
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
  downloadProductTypeTemplateUrl: (code: string) => `/api/templates/product-types/${code}/download`,
  previewProductTypeTemplate: (code: string) => api.get<AmazonProductTypeTemplatePreviewResponse>(`/templates/product-types/${code}/preview`).then(r => r.data),
  updateExportConfig: async (code: string, payload: { export_sheet_name_override?: string | null, export_start_row_override?: number | null }) => {
    const response = await api.patch<AmazonProductType>(`/templates/${code}/export-config`, payload)
    return response.data
  },
}

export interface AmazonProductTypeTemplatePreviewResponse {
  product_code: string
  original_filename: string
  sheet_name: string
  max_row: number
  max_column: number
  preview_row_count: number
  preview_column_count: number
  grid: string[][]
}

export interface AmazonCustomizationTemplatePreviewResponse {
  template_id: number
  original_filename: string
  sheet_name: string
  max_row: number
  max_column: number
  preview_row_count: number
  preview_column_count: number
  grid: string[][]
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
  listMaterialRoleConfigs: () =>
    api.get<MaterialRoleConfig[]>('/material-role-configs').then(r => r.data),

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

  // Export Settings
  getExport: () => api.get<{ id: number; default_save_path_template?: string; amazon_customization_export_format?: string }>('/settings/export').then(r => r.data),
  updateExport: (data: { default_save_path_template?: string; amazon_customization_export_format?: string }) => api.put<{ id: number; default_save_path_template?: string; amazon_customization_export_format?: string }>('/settings/export', data).then(r => r.data),

  // Customization Templates
  listAmazonCustomizationTemplates: () => api.get<AmazonCustomizationTemplate[]>('/settings/amazon-customization-templates').then(r => r.data),
  uploadAmazonCustomizationTemplate: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/settings/amazon-customization-templates/upload', formData).then(r => r.data)
  },
  updateAmazonCustomizationTemplate: (id: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/settings/amazon-customization-templates/${id}/upload`, formData).then(r => r.data)
  },
  deleteAmazonCustomizationTemplate: (id: number) => api.delete(`/settings/amazon-customization-templates/${id}`),
  downloadAmazonCustomizationTemplateUrl: (id: number) => `/api/settings/amazon-customization-templates/${id}/download`,

  assignAmazonCustomizationTemplate: (equipmentTypeId: number, templateId: number | null) =>
    api.post<EquipmentType>(`/settings/equipment-types/${equipmentTypeId}/amazon-customization-template/assign`, { template_id: templateId }).then(r => r.data),
  previewCustomizationTemplate: (id: number) => api.get<AmazonCustomizationTemplatePreviewResponse>(`/settings/amazon-customization-templates/${id}/preview`).then(r => r.data),

  // Multi-template management
  listEquipmentTypeCustomizationTemplates: (equipmentTypeId: number) =>
    api.get<EquipmentTypeCustomizationTemplatesResponse>(`/settings/equipment-types/${equipmentTypeId}/amazon-customization-templates`).then(r => r.data),
  assignEquipmentTypeCustomizationTemplate: (equipmentTypeId: number, templateId: number, slot: number) =>
    api.post<EquipmentTypeCustomizationTemplatesResponse>(`/settings/equipment-types/${equipmentTypeId}/amazon-customization-templates/assign`, { template_id: templateId, slot }).then(r => r.data),
  setEquipmentTypeCustomizationTemplateDefault: (equipmentTypeId: number, templateId: number) =>
    api.post(`/settings/equipment-types/${equipmentTypeId}/amazon-customization-templates/default`, { template_id: templateId }).then(r => r.data),
  unassignEquipmentTypeCustomizationTemplate: (equipmentTypeId: number, templateId: number) =>
    api.delete(`/settings/equipment-types/${equipmentTypeId}/amazon-customization-templates/${templateId}`).then(r => r.data),

  assignReverbTemplate: (equipmentTypeId: number, templateId: number | null) =>
    api.post<EquipmentType>(`/settings/equipment-types/${equipmentTypeId}/reverb-template/assign`, { template_id: templateId }).then(r => r.data),
}




export interface ExportValidationIssue {
  severity: 'error' | 'warning'
  model_id?: number
  model_name?: string
  message: string
}

export interface ExportValidationResponse {
  status: 'valid' | 'warnings' | 'errors'
  summary_counts: {
    total_models: number
    issues: number
    errors?: number
    warnings?: number
  }
  items: ExportValidationIssue[]
}

export const exportApi = {
  validateExport: (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') =>
    api.post<ExportValidationResponse>('/export/validate', { model_ids: modelIds, listing_type: listingType }).then(r => r.data),



  downloadXlsx: async (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') => {
    const response = await api.post('/export/download/xlsx', { model_ids: modelIds, listing_type: listingType }, { responseType: 'blob' })
    return response
  },

  downloadXlsm: async (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') => {
    console.log("[EXPORT][XLSM] download fn: entered");
    console.trace("[EXPORT][XLSM] download fn stack");
    const response = await api.post('/export/download/xlsm', { model_ids: modelIds, listing_type: listingType }, { responseType: 'blob' })
    if (response.status !== 200) {
      throw new Error(`Export failed with status ${response.status}`);
    }
    return response
  },

  downloadCsv: async (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') => {
    const response = await api.post('/export/download/csv', { model_ids: modelIds, listing_type: listingType }, { responseType: 'blob' })
    return response
  },

  downloadCustomizationXlsx: async (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') => {
    const response = await api.post('/export/download/customization/xlsx', { model_ids: modelIds, listing_type: listingType }, { responseType: 'blob' })
    return response
  },

  downloadReverbCsv: async (modelIds: number[], listingType: 'individual' | 'parent_child' = 'individual') => {
    const response = await api.post('/export/download/reverb/csv', { model_ids: modelIds, listing_type: listingType }, { responseType: 'blob' })
    return response
  },

  downloadZip: async (
    modelIds: number[],
    listingType: 'individual' | 'parent_child',
    includeCustomization: boolean,
    tokens: { marketplace: string; manufacturer: string; series: string; date: string },
    customizationFormat: string = 'xlsx'
  ) => {
    const payload = {
      model_ids: modelIds,
      listing_type: listingType,
      include_customization: includeCustomization,
      marketplace_token: tokens.marketplace,
      manufacturer_token: tokens.manufacturer,
      series_token: tokens.series,
      date_token: tokens.date,
      customization_format: customizationFormat
    }
    const response = await api.post('/export/download/zip', payload, { responseType: 'blob' })
    return response
  },
}

export interface EbayTemplateResponse {
  id: number
  original_filename: string
  file_size: number
  sha256?: string
  uploaded_at?: string
}

export interface EbayTemplateParseSummary {
  template_id: number
  fields_inserted: number
  values_inserted: number
  defaults_applied: number
  values_ignored_not_in_template: number
  defaults_ignored_not_in_template: number
  sheet_names: string[]
}

export interface EbayValidValueDetailed {
  id: number
  value: string
}

export interface EbayFieldResponse {
  id: number
  ebay_template_id: number
  field_name: string
  display_name?: string
  required: boolean
  order_index?: number
  selected_value?: string
  custom_value?: string
  allowed_values: string[]
  allowed_values_detailed?: EbayValidValueDetailed[]
}

export interface EbayTemplatePreviewResponse {
  template_id: number
  original_filename: string
  sheet_name: string
  max_row: number
  max_column: number
  preview_row_count: number
  preview_column_count: number
  grid: string[][]
}

export interface EbayTemplateIntegrityResponse {
  template_id: number
  original_filename: string
  file_size: number
  sha256?: string
  uploaded_at?: string
}

export interface EbayTemplateVerificationResponse {
  template_id: number
  status: string  // "match", "mismatch", "missing", "unknown"
  stored_sha256?: string
  stored_file_size?: number
  computed_sha256?: string
  computed_file_size?: number
  verified_at: string
}

export interface EbayTemplateFieldsResponse {
  template_id: number
  fields: EbayFieldResponse[]
}

export const ebayTemplatesApi = {
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<EbayTemplateResponse>('/ebay-templates/upload', formData).then(r => r.data)
  },
  getCurrent: () => api.get<EbayTemplateResponse | null>('/ebay-templates/current').then(r => r.data),
  parse: (id: number) => api.post<EbayTemplateParseSummary>(`/ebay-templates/${id}/parse`).then(r => r.data),
  getFields: (id: number) => api.get<EbayTemplateFieldsResponse>(`/ebay-templates/${id}/fields`).then(r => r.data),
  getCurrentFields: () => api.get<EbayTemplateFieldsResponse>('/ebay-templates/current/fields').then(r => r.data),
  updateField: (fieldId: number, payload: { required?: boolean; selected_value?: string | null; custom_value?: string | null }) =>
    api.patch<EbayFieldResponse>(`/ebay-templates/fields/${fieldId}`, payload).then(r => r.data),
  addValidValue: (fieldId: number, value: string) =>
    api.post<EbayFieldResponse>(`/ebay-templates/fields/${fieldId}/valid-values`, { value }).then(r => r.data),
  deleteValidValue: (fieldId: number, valueId: number) =>
    api.delete<EbayFieldResponse>(`/ebay-templates/fields/${fieldId}/valid-values/${valueId}`).then(r => r.data),
  previewCurrentTemplateInlineUrl: () => '/api/ebay-templates/current/download?mode=inline',
  downloadCurrentTemplateUrl: () => '/api/ebay-templates/current/download?mode=download',
  previewCurrentTemplate: () => api.get<EbayTemplatePreviewResponse>('/ebay-templates/current/preview').then(r => r.data),
  getCurrentIntegrity: () => api.get<EbayTemplateIntegrityResponse>('/ebay-templates/current/integrity').then(r => r.data),
  getCurrentVerification: () => api.get<EbayTemplateVerificationResponse>('/ebay-templates/current/verify').then(r => r.data),
}

// eBay Variations API
export interface GenerateVariationsRequest {
  model_ids: number[]
  material_id?: number
  role_key?: string
  material_colour_surcharge_id?: number | null
  design_option_ids: number[]
  pricing_option_ids: number[]
  with_padding?: boolean
}

export interface VariationRow {
  model_id: number
  sku: string
  material_id: number
  material_colour_surcharge_id: number | null
  design_option_ids: number[]
  pricing_option_ids: number[]
}

export interface GenerateVariationsResponse {
  created: number
  updated: number
  errors: string[]
  rows: VariationRow[]
}

export const ebayVariationsApi = {
  generate: (data: GenerateVariationsRequest) =>
    api.post<GenerateVariationsResponse>('/ebay-variations/generate', data).then(r => r.data),
  getExisting: (modelIds: number[]) =>
    api.get<VariationRow[]>(`/ebay-variations/by-models?model_ids=${modelIds.join(',')}`).then(r => r.data)
}

export const ebayExportApi = {
  exportCsv: async (payload: { model_ids: number[], [key: string]: any }) => {
    const response = await api.post('/ebay-export/export', payload, { responseType: 'blob' })
    return response
  }
}

// Reverb Templates API
export interface ReverbTemplateResponse {
  id: number
  original_filename: string
  file_size: number
  sha256?: string
  uploaded_at?: string
}

export interface ReverbTemplateParseSummary {
  template_id: number
  fields_inserted: number
  values_inserted: number
  defaults_applied: number
  values_ignored_not_in_template: number
  defaults_ignored_not_in_template: number
  sheet_names: string[]
}

export interface ReverbValidValueDetailed {
  id: number
  value: string
}

export interface ReverbFieldOverrideResponse {
  id: number
  equipment_type_id: number
  reverb_field_id: number
  default_value: string | null
}

export interface ReverbFieldResponse {
  id: number
  reverb_template_id: number
  field_name: string
  display_name?: string
  required: boolean
  order_index?: number
  selected_value?: string
  custom_value?: string
  allowed_values: string[]
  allowed_values_detailed?: ReverbValidValueDetailed[]
  overrides?: ReverbFieldOverrideResponse[]
}

export interface ReverbTemplatePreviewResponse {
  template_id: number
  original_filename: string
  sheet_name: string
  max_row: number
  max_column: number
  preview_row_count: number
  preview_column_count: number
  grid: string[][]
}

export interface ReverbTemplateFieldsResponse {
  template_id: number
  fields: ReverbFieldResponse[]
}

export const reverbTemplatesApi = {
  list: () => api.get<ReverbTemplateResponse[]>('/reverb-templates').then(r => r.data),
  get: (id: number) => api.get<ReverbTemplateResponse>(`/reverb-templates/${id}`).then(r => r.data),
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ReverbTemplateResponse>('/reverb-templates/upload', formData).then(r => r.data)
  },
  getCurrent: () => api.get<ReverbTemplateResponse | null>('/reverb-templates/current').then(r => r.data),
  parse: (id: number) => api.post<ReverbTemplateParseSummary>(`/reverb-templates/${id}/parse`).then(r => r.data),
  getFields: (id: number) => api.get<ReverbTemplateFieldsResponse>(`/reverb-templates/${id}/fields`).then(r => r.data),
  getCurrentFields: () => api.get<ReverbTemplateFieldsResponse>('/reverb-templates/current/fields').then(r => r.data),
  updateField: (fieldId: number, payload: { required?: boolean; selected_value?: string | null; custom_value?: string | null }) =>
    api.patch<ReverbFieldResponse>(`/reverb-templates/fields/${fieldId}`, payload).then(r => r.data),
  addValidValue: (fieldId: number, value: string) =>
    api.post<ReverbFieldResponse>(`/reverb-templates/fields/${fieldId}/valid-values`, { value }).then(r => r.data),
  deleteValidValue: (fieldId: number, valueId: number) =>
    api.delete<ReverbFieldResponse>(`/reverb-templates/fields/${fieldId}/valid-values/${valueId}`).then(r => r.data),
  createFieldOverride: (fieldId: number, equipmentTypeId: number, defaultValue: string) =>
    api.post<ReverbFieldResponse>(`/reverb-templates/fields/${fieldId}/overrides`, { equipment_type_id: equipmentTypeId, default_value: defaultValue }).then(r => r.data),
  deleteFieldOverride: (fieldId: number, overrideId: number) =>
    api.delete<ReverbFieldResponse>(`/reverb-templates/fields/${fieldId}/overrides/${overrideId}`).then(r => r.data),
  previewCurrentTemplate: () => api.get<ReverbTemplatePreviewResponse>('/reverb-templates/current/preview').then(r => r.data),
  downloadCurrentTemplateUrl: () => '/api/reverb-templates/current/download?mode=download',
}

export default api
