import { Routes, Route } from 'react-router-dom'
import { Box } from '@mui/material'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
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
import TemplatesPage from './pages/TemplatesPage'
import ExportPage from './pages/ExportPage'
import SettingsPage from './pages/SettingsPage'

function App() {
  return (
    <Box sx={{ display: 'flex' }}>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
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
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </Box>
  )
}

export default App
