import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, CircularProgress,
  Chip, FormControl, InputLabel, Select, MenuItem, Switch, FormControlLabel
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import InventoryIcon from '@mui/icons-material/Inventory'
import StarIcon from '@mui/icons-material/Star'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { suppliersApi, materialsApi } from '../services/api'
import type { Supplier, Material, SupplierMaterialWithMaterial } from '../types'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    address: '',
    phone: '',
    email: '',
    website: ''
  })
  
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierMaterials, setSupplierMaterials] = useState<SupplierMaterialWithMaterial[]>([])
  const [addMaterialDialogOpen, setAddMaterialDialogOpen] = useState(false)
  const [editMaterialDialogOpen, setEditMaterialDialogOpen] = useState(false)
  const [editingMaterialLink, setEditingMaterialLink] = useState<SupplierMaterialWithMaterial | null>(null)
  const [materialFormData, setMaterialFormData] = useState({
    material_id: 0,
    unit_cost: 0,
    shipping_cost: 0,
    quantity_purchased: 1,
    is_preferred: false
  })

  useEffect(() => {
    loadSuppliers()
    loadMaterials()
  }, [])

  const loadSuppliers = async () => {
    try {
      setLoading(true)
      const data = await suppliersApi.list()
      setSuppliers(data)
    } catch (err) {
      setError('Failed to load suppliers')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadMaterials = async () => {
    try {
      const data = await materialsApi.list()
      setMaterials(data)
    } catch (err) {
      console.error(err)
    }
  }

  const loadSupplierMaterials = async (supplierId: number) => {
    try {
      const data = await suppliersApi.getMaterials(supplierId)
      setSupplierMaterials(data)
    } catch (err) {
      setError('Failed to load supplier materials')
    }
  }

  const handleOpenDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier)
      setFormData({
        name: supplier.name,
        contact_name: supplier.contact_name || '',
        address: supplier.address || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        website: supplier.website || ''
      })
    } else {
      setEditingSupplier(null)
      setFormData({
        name: '',
        contact_name: '',
        address: '',
        phone: '',
        email: '',
        website: ''
      })
    }
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
    setEditingSupplier(null)
    setFormData({
      name: '',
      contact_name: '',
      address: '',
      phone: '',
      email: '',
      website: ''
    })
  }

  const handleSave = async () => {
    try {
      setError(null)
      if (editingSupplier) {
        await suppliersApi.update(editingSupplier.id, formData)
      } else {
        await suppliersApi.create(formData)
      }
      handleCloseDialog()
      loadSuppliers()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save supplier')
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this supplier?')) return
    try {
      await suppliersApi.delete(id)
      loadSuppliers()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete supplier')
    }
  }

  const handleViewMaterials = async (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    await loadSupplierMaterials(supplier.id)
  }

  const handleBackToList = () => {
    setSelectedSupplier(null)
    setSupplierMaterials([])
  }

  const handleOpenAddMaterial = () => {
    setMaterialFormData({
      material_id: 0,
      unit_cost: 0,
      shipping_cost: 0,
      quantity_purchased: 1,
      is_preferred: false
    })
    setAddMaterialDialogOpen(true)
  }

  const handleOpenEditMaterial = (link: SupplierMaterialWithMaterial) => {
    setEditingMaterialLink(link)
    setMaterialFormData({
      material_id: link.material_id,
      unit_cost: link.unit_cost,
      shipping_cost: link.shipping_cost,
      quantity_purchased: link.quantity_purchased || 1,
      is_preferred: link.is_preferred
    })
    setEditMaterialDialogOpen(true)
  }

  const handleAddMaterial = async () => {
    if (!selectedSupplier || !materialFormData.material_id) return
    try {
      await suppliersApi.createMaterialLink({
        supplier_id: selectedSupplier.id,
        material_id: materialFormData.material_id,
        unit_cost: materialFormData.unit_cost,
        shipping_cost: materialFormData.shipping_cost,
        quantity_purchased: materialFormData.quantity_purchased,
        is_preferred: materialFormData.is_preferred
      })
      setAddMaterialDialogOpen(false)
      loadSupplierMaterials(selectedSupplier.id)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add material')
    }
  }

  const handleUpdateMaterial = async () => {
    if (!selectedSupplier || !editingMaterialLink) return
    try {
      await suppliersApi.updateMaterialLink(editingMaterialLink.id, {
        supplier_id: selectedSupplier.id,
        material_id: editingMaterialLink.material_id,
        unit_cost: materialFormData.unit_cost,
        shipping_cost: materialFormData.shipping_cost,
        quantity_purchased: materialFormData.quantity_purchased,
        is_preferred: materialFormData.is_preferred
      })
      setEditMaterialDialogOpen(false)
      setEditingMaterialLink(null)
      loadSupplierMaterials(selectedSupplier.id)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update material')
    }
  }

  const handleDeleteMaterial = async (linkId: number) => {
    if (!window.confirm('Remove this material from this supplier?')) return
    try {
      await suppliersApi.deleteMaterialLink(linkId)
      if (selectedSupplier) {
        loadSupplierMaterials(selectedSupplier.id)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove material')
    }
  }

  const availableMaterials = materials.filter(
    m => !supplierMaterials.some(sm => sm.material_id === m.id)
  )

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (selectedSupplier) {
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <IconButton onClick={handleBackToList}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">{selectedSupplier.name} - Materials</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {selectedSupplier.contact_name && `Contact: ${selectedSupplier.contact_name}`}
            {selectedSupplier.phone && ` | Phone: ${selectedSupplier.phone}`}
            {selectedSupplier.email && ` | Email: ${selectedSupplier.email}`}
          </Typography>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddMaterial}
            disabled={availableMaterials.length === 0}
          >
            Add Material
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Material Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Unit Cost</TableCell>
                <TableCell>Shipping ($)</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell>$/Unit</TableCell>
                <TableCell>$/Sq In</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {supplierMaterials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography color="text.secondary">No materials linked to this supplier</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                supplierMaterials.map(sm => {
                  const isFabric = sm.material_type === 'fabric'
                  return (
                  <TableRow key={sm.id} hover>
                    <TableCell>{sm.material_name}</TableCell>
                    <TableCell>
                      <Chip 
                        label={sm.material_type || 'fabric'} 
                        size="small"
                        color={isFabric ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>${sm.unit_cost.toFixed(2)}</TableCell>
                    <TableCell>${sm.shipping_cost.toFixed(2)}</TableCell>
                    <TableCell>{sm.quantity_purchased.toFixed(1)}</TableCell>
                    <TableCell>${sm.cost_per_linear_yard.toFixed(2)}</TableCell>
                    <TableCell>{isFabric ? `$${sm.cost_per_square_inch.toFixed(4)}` : '-'}</TableCell>
                    <TableCell>
                      {sm.is_preferred && (
                        <Chip
                          icon={<StarIcon />}
                          label="Preferred"
                          size="small"
                          color="primary"
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleOpenEditMaterial(sm)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteMaterial(sm.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Dialog open={addMaterialDialogOpen} onClose={() => setAddMaterialDialogOpen(false)}>
          <DialogTitle>Add Material to {selectedSupplier.name}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, minWidth: 350 }}>
              <FormControl fullWidth>
                <InputLabel>Material</InputLabel>
                <Select
                  value={materialFormData.material_id || ''}
                  label="Material"
                  onChange={(e) => setMaterialFormData({ ...materialFormData, material_id: e.target.value as number })}
                >
                  {availableMaterials.map(m => (
                    <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Unit Cost ($)"
                type="number"
                value={materialFormData.unit_cost}
                onChange={(e) => setMaterialFormData({ ...materialFormData, unit_cost: parseFloat(e.target.value) || 0 })}
                fullWidth
                helperText="Cost per unit (yard for fabric, per package for hardware)"
              />
              <TextField
                label="Shipping Cost ($)"
                type="number"
                value={materialFormData.shipping_cost}
                onChange={(e) => setMaterialFormData({ ...materialFormData, shipping_cost: parseFloat(e.target.value) || 0 })}
                fullWidth
                helperText="Flat shipping cost - will be divided by quantity purchased"
              />
              <TextField
                label="Quantity Purchased"
                type="number"
                value={materialFormData.quantity_purchased}
                onChange={(e) => setMaterialFormData({ ...materialFormData, quantity_purchased: parseFloat(e.target.value) || 1 })}
                fullWidth
                helperText="Number of units in this purchase (yards for fabric, packages for hardware)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={materialFormData.is_preferred}
                    onChange={(e) => setMaterialFormData({ ...materialFormData, is_preferred: e.target.checked })}
                  />
                }
                label="Set as Preferred Supplier"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setAddMaterialDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddMaterial}
              variant="contained"
              disabled={!materialFormData.material_id}
            >
              Add
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={editMaterialDialogOpen} onClose={() => setEditMaterialDialogOpen(false)}>
          <DialogTitle>Edit Material - {editingMaterialLink?.material_name}</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, minWidth: 350 }}>
              <TextField
                label="Unit Cost ($)"
                type="number"
                value={materialFormData.unit_cost}
                onChange={(e) => setMaterialFormData({ ...materialFormData, unit_cost: parseFloat(e.target.value) || 0 })}
                fullWidth
                helperText="Cost per unit (yard for fabric, per package for hardware)"
              />
              <TextField
                label="Shipping Cost ($)"
                type="number"
                value={materialFormData.shipping_cost}
                onChange={(e) => setMaterialFormData({ ...materialFormData, shipping_cost: parseFloat(e.target.value) || 0 })}
                fullWidth
                helperText="Flat shipping cost - will be divided by quantity purchased"
              />
              <TextField
                label="Quantity Purchased"
                type="number"
                value={materialFormData.quantity_purchased}
                onChange={(e) => setMaterialFormData({ ...materialFormData, quantity_purchased: parseFloat(e.target.value) || 1 })}
                fullWidth
                helperText="Number of units in this purchase (yards for fabric, packages for hardware)"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={materialFormData.is_preferred}
                    onChange={(e) => setMaterialFormData({ ...materialFormData, is_preferred: e.target.checked })}
                  />
                }
                label="Set as Preferred Supplier"
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditMaterialDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateMaterial} variant="contained">
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Suppliers</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Supplier
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Website</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">No suppliers found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                suppliers.map(supplier => (
                  <TableRow key={supplier.id} hover>
                    <TableCell>
                      <Typography fontWeight="medium">{supplier.name}</Typography>
                      {supplier.address && (
                        <Typography variant="body2" color="text.secondary">
                          {supplier.address}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{supplier.contact_name || '-'}</TableCell>
                    <TableCell>{supplier.phone || '-'}</TableCell>
                    <TableCell>
                      {supplier.email ? (
                        <a href={`mailto:${supplier.email}`}>{supplier.email}</a>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {supplier.website ? (
                        <a href={supplier.website} target="_blank" rel="noopener noreferrer">
                          {supplier.website.replace(/^https?:\/\//, '')}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleViewMaterials(supplier)} title="View Materials" color="primary">
                        <InventoryIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleOpenDialog(supplier)} title="Edit">
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(supplier.id)} title="Delete">
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Business Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Contact Name"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              fullWidth
              placeholder="https://example.com"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name}>
            {editingSupplier ? 'Save Changes' : 'Add Supplier'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
