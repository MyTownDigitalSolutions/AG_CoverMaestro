import axios from 'axios'
import type {
  Manufacturer, Series, EquipmentType, Model, Material,
  Customer, Order, PricingOption, PricingResult, AmazonProductType,
  EnumValue
} from '../types'

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
  list: (manufacturerId?: number) => api.get<Series[]>('/series', { params: { manufacturer_id: manufacturerId } }).then(r => r.data),
  create: (data: { name: string; manufacturer_id: number }) => api.post<Series>('/series', data).then(r => r.data),
  delete: (id: number) => api.delete(`/series/${id}`),
}

export const equipmentTypesApi = {
  list: () => api.get<EquipmentType[]>('/equipment-types').then(r => r.data),
  create: (data: Partial<EquipmentType>) => api.post<EquipmentType>('/equipment-types', data).then(r => r.data),
}

export const modelsApi = {
  list: (seriesId?: number) => api.get<Model[]>('/models', { params: { series_id: seriesId } }).then(r => r.data),
  get: (id: number) => api.get<Model>(`/models/${id}`).then(r => r.data),
  create: (data: Partial<Model>) => api.post<Model>('/models', data).then(r => r.data),
  update: (id: number, data: Partial<Model>) => api.put<Model>(`/models/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/models/${id}`),
}

export const materialsApi = {
  list: () => api.get<Material[]>('/materials').then(r => r.data),
  get: (id: number) => api.get<Material>(`/materials/${id}`).then(r => r.data),
  create: (data: Partial<Material>) => api.post<Material>('/materials', data).then(r => r.data),
  update: (id: number, data: Partial<Material>) => api.put<Material>(`/materials/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/materials/${id}`),
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
}

export const enumsApi = {
  handleLocations: () => api.get<EnumValue[]>('/enums/handle-locations').then(r => r.data),
  angleTypes: () => api.get<EnumValue[]>('/enums/angle-types').then(r => r.data),
  carriers: () => api.get<EnumValue[]>('/enums/carriers').then(r => r.data),
  marketplaces: () => api.get<EnumValue[]>('/enums/marketplaces').then(r => r.data),
}

export default api
