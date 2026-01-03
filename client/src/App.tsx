import { Routes, Route } from 'react-router-dom'
import { Box } from '@mui/material'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ProductCatalogCreationPage from './pages/ProductCatalogCreationPage'
import PricingCalculationSettingsPage from './pages/PricingCalculationSettingsPage'
import SuppliersMaterialsPage from './pages/SuppliersMaterialsPage'
import ManufacturersPage from './pages/ManufacturersPage'
import ModelsPage from './pages/ModelsPage'
import MaterialsPage from './pages/MaterialsPage'
import SuppliersPage from './pages/SuppliersPage'
import EquipmentTypesPage from './pages/EquipmentTypesPage'
import PricingOptionsPage from './pages/PricingOptionsPage'
import DesignOptionsPage from './pages/DesignOptionsPage'
import CustomersPage from './pages/CustomersPage'
import OrdersPage from './pages/OrdersPage'
import PricingCalculator from './pages/PricingCalculator'

import AmazonTemplatesPage from './pages/AmazonTemplatesPage'
import EbayTemplatesPage from './pages/EbayTemplatesPage'
import ReverbTemplatesPage from './pages/ReverbTemplatesPage'
import EtsyTemplatesPage from './pages/EtsyTemplatesPage'
import AmazonExportPage from './pages/ExportPage' // Amazon Export (keeping existing file)
import EbayExportPage from './pages/EbayExportPage'
import ReverbExportPage from './pages/ReverbExportPage'
import EtsyExportPage from './pages/EtsyExportPage'
import SettingsPage from './pages/SettingsPage'
import ShippingRatesPage from './pages/ShippingRatesPage'
import ShippingDefaultsPage from './pages/ShippingDefaultsPage'

function App() {
  return (
    <Box sx={{ display: 'flex' }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/product-catalog" element={<ProductCatalogCreationPage />} />
          <Route path="/pricing-settings" element={<PricingCalculationSettingsPage />} />
          <Route path="/suppliers-materials" element={<SuppliersMaterialsPage />} />
          <Route path="/manufacturers" element={<ManufacturersPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/equipment-types" element={<EquipmentTypesPage />} />
          <Route path="/pricing-options" element={<PricingOptionsPage />} />
          <Route path="/design-options" element={<DesignOptionsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/pricing" element={<PricingCalculator />} />
          <Route path="/templates/amazon" element={<AmazonTemplatesPage />} />
          <Route path="/templates/ebay" element={<EbayTemplatesPage />} />
          <Route path="/templates/reverb" element={<ReverbTemplatesPage />} />
          <Route path="/templates/etsy" element={<EtsyTemplatesPage />} />
          <Route path="/export/amazon" element={<AmazonExportPage />} />
          <Route path="/export/ebay" element={<EbayExportPage />} />
          <Route path="/export/reverb" element={<ReverbExportPage />} />
          <Route path="/export/etsy" element={<EtsyExportPage />} />
          <Route path="/export" element={<AmazonExportPage />} /> {/* Legacy redirect to Amazon */}
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/shipping-rates" element={<ShippingRatesPage />} />
          <Route path="/settings/shipping-defaults" element={<ShippingDefaultsPage />} />
        </Routes>
      </Layout>
    </Box>
  )
}

export default App
