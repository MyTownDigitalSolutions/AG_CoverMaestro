import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Alert,
  FormControl, InputLabel, Select, MenuItem, Radio
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import StarIcon from '@mui/icons-material/Star'
import { materialsApi, suppliersApi } from '../services/api'
import type { Material, Supplier, SupplierMaterialWithSupplier, MaterialType, UnitOfMeasure } from '../types'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [materialSuppliers, setMaterialSuppliers] = useState<SupplierMaterialWithSupplier[]>([])
  const [addSupplierDialogOpen, setAddSupplierDialogOpen] = useState(false)
  const [newSupplierLink, setNewSupplierLink] = useState({ supplier_id: 0, unit_cost: 0, shipping_cost: 0, quantity_purchased: 1 })
  
  const [formData, setFormData] = useState({
    name: '',
    base_color: '',
    material_type: 'fabric' as MaterialType,
    linear_yard_width: 54 as number | undefined,
    cost_per_linear_yard: 0,
    weight_per_linear_yard: 0 as number | undefined,
    labor_time_minutes: 45,
    unit_of_measure: 'yard' as UnitOfMeasure | undefined,
    package_quantity: undefined as number | undefined
  })

  const loadMaterials = async () => {
    const data = await materialsApi.list()
    setMaterials(data)
  }

  const loadSuppliers = async () => {
    const data = await suppliersApi.list()
    setSuppliers(data)
  }

  useEffect(() => {
    loadMaterials()
    loadSuppliers()
  }, [])

  const handleSave = async () => {
    try {
      if (editingMaterial) {
        await materialsApi.update(editingMaterial.id, formData)
      } else {
        await materialsApi.create(formData)
      }
      setDialogOpen(false)
      resetForm()
      loadMaterials()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save material')
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this material?')) {
      await materialsApi.delete(id)
      loadMaterials()
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      base_color: '',
      material_type: 'fabric' as MaterialType,
      linear_yard_width: 54,
      cost_per_linear_yard: 0,
      weight_per_linear_yard: 0,
      labor_time_minutes: 45,
      unit_of_measure: 'yard' as UnitOfMeasure,
      package_quantity: undefined
    })
    setEditingMaterial(null)
  }

  const openEdit = (material: Material) => {
    setEditingMaterial(material)
    setFormData({
      name: material.name,
      base_color: material.base_color,
      material_type: material.material_type || 'fabric',
      linear_yard_width: material.linear_yard_width,
      cost_per_linear_yard: material.cost_per_linear_yard,
      weight_per_linear_yard: material.weight_per_linear_yard,
      labor_time_minutes: material.labor_time_minutes,
      unit_of_measure: material.unit_of_measure,
      package_quantity: material.package_quantity
    })
    setDialogOpen(true)
  }

  const openSupplierDialog = async (material: Material) => {
    setSelectedMaterial(material)
    try {
      const data = await materialsApi.getSuppliers(material.id)
      setMaterialSuppliers(data)
      setSupplierDialogOpen(true)
    } catch (err) {
      setError('Failed to load suppliers for this material')
    }
  }

  const handleSetPreferred = async (supplierId: number) => {
    if (!selectedMaterial) return
    try {
      await materialsApi.setPreferredSupplier(selectedMaterial.id, supplierId)
      const data = await materialsApi.getSuppliers(selectedMaterial.id)
      setMaterialSuppliers(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to set preferred supplier')
    }
  }

  const handleAddSupplierLink = async () => {
    if (!selectedMaterial || !newSupplierLink.supplier_id) return
    try {
      await suppliersApi.createMaterialLink({
        supplier_id: newSupplierLink.supplier_id,
        material_id: selectedMaterial.id,
        unit_cost: newSupplierLink.unit_cost,
        shipping_cost: newSupplierLink.shipping_cost,
        quantity_purchased: newSupplierLink.quantity_purchased,
        is_preferred: false
      })
      const data = await materialsApi.getSuppliers(selectedMaterial.id)
      setMaterialSuppliers(data)
      setAddSupplierDialogOpen(false)
      setNewSupplierLink({ supplier_id: 0, unit_cost: 0, shipping_cost: 0, quantity_purchased: 1 })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add supplier')
    }
  }

  const handleRemoveSupplierLink = async (linkId: number) => {
    if (!window.confirm('Remove this supplier from this material?')) return
    try {
      await suppliersApi.deleteMaterialLink(linkId)
      if (selectedMaterial) {
        const data = await materialsApi.getSuppliers(selectedMaterial.id)
        setMaterialSuppliers(data)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to remove supplier')
    }
  }

  const availableSuppliers = suppliers.filter(
    s => !materialSuppliers.some(ms => ms.supplier_id === s.id)
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Materials</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            resetForm()
            setDialogOpen(true)
          }}
        >
          Add Material
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Base Color</TableCell>
              <TableCell>Width (in)</TableCell>
              <TableCell>Weight/Yard (lbs)</TableCell>
              <TableCell>Weight/Sq In (oz)</TableCell>
              <TableCell>Pkg Qty</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materials.map((material) => {
              const isFabric = material.material_type === 'fabric'
              const width = material.linear_yard_width || 0
              const weight = material.weight_per_linear_yard || 0
              const weightPerSqIn = width > 0 && weight > 0
                ? (weight * 16) / (width * 36)
                : 0
              return (
              <TableRow key={material.id}>
                <TableCell>{material.name}</TableCell>
                <TableCell>
                  <Chip 
                    label={material.material_type || 'fabric'} 
                    size="small" 
                    color={isFabric ? 'primary' : 'default'}
                  />
                </TableCell>
                <TableCell>{material.base_color}</TableCell>
                <TableCell>{isFabric ? width : '-'}</TableCell>
                <TableCell>{isFabric ? weight : '-'}</TableCell>
                <TableCell>{isFabric ? weightPerSqIn.toFixed(4) : '-'}</TableCell>
                <TableCell>{!isFabric && material.package_quantity ? material.package_quantity : '-'}</TableCell>
                <TableCell>
                  <IconButton 
                    onClick={() => openSupplierDialog(material)} 
                    title="Manage Suppliers"
                    color="primary"
                  >
                    <LocalShippingIcon />
                  </IconButton>
                  <IconButton onClick={() => openEdit(material)} title="Edit">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(material.id)} title="Delete" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingMaterial ? 'Edit Material' : 'Add Material'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Material Type</InputLabel>
                <Select
                  value={formData.material_type}
                  label="Material Type"
                  onChange={(e) => setFormData({ ...formData, material_type: e.target.value as MaterialType })}
                >
                  <MenuItem value="fabric">Fabric</MenuItem>
                  <MenuItem value="hardware">Hardware</MenuItem>
                  <MenuItem value="packaging">Packaging</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Base Color"
                value={formData.base_color}
                onChange={(e) => setFormData({ ...formData, base_color: e.target.value })}
              />
            </Grid>
            {formData.material_type === 'fabric' && (
              <>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Width (inches)"
                    value={formData.linear_yard_width || ''}
                    onChange={(e) => setFormData({ ...formData, linear_yard_width: parseFloat(e.target.value) || undefined })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Weight per Linear Yard (lbs)"
                    value={formData.weight_per_linear_yard || ''}
                    onChange={(e) => setFormData({ ...formData, weight_per_linear_yard: parseFloat(e.target.value) || undefined })}
                  />
                </Grid>
              </>
            )}
            {formData.material_type !== 'fabric' && (
              <>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Unit of Measure</InputLabel>
                    <Select
                      value={formData.unit_of_measure || 'each'}
                      label="Unit of Measure"
                      onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value as UnitOfMeasure })}
                    >
                      <MenuItem value="each">Each</MenuItem>
                      <MenuItem value="package">Package</MenuItem>
                      <MenuItem value="box">Box</MenuItem>
                      <MenuItem value="set">Set</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Quantity per Package"
                    value={formData.package_quantity || ''}
                    onChange={(e) => setFormData({ ...formData, package_quantity: parseFloat(e.target.value) || undefined })}
                    helperText="How many items in one package/box"
                  />
                </Grid>
              </>
            )}
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Default Cost ($)"
                value={formData.cost_per_linear_yard}
                onChange={(e) => setFormData({ ...formData, cost_per_linear_yard: parseFloat(e.target.value) })}
                helperText="Fallback cost if no preferred supplier"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Labor Time (minutes)"
                value={formData.labor_time_minutes}
                onChange={(e) => setFormData({ ...formData, labor_time_minutes: parseFloat(e.target.value) })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={supplierDialogOpen} 
        onClose={() => setSupplierDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Suppliers for {selectedMaterial?.name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The preferred supplier's unit cost will be used for pricing calculations. 
            If no preferred supplier is set, the material's default cost will be used.
          </Typography>
          
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={50}>Preferred</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Unit Cost</TableCell>
                  <TableCell>Shipping</TableCell>
                  <TableCell>{selectedMaterial?.material_type === 'fabric' ? 'Yards' : 'Qty'}</TableCell>
                  <TableCell width={80}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {materialSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">No suppliers linked to this material</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  materialSuppliers.map(ms => (
                    <TableRow key={ms.id}>
                      <TableCell>
                        <Radio
                          checked={ms.is_preferred}
                          onChange={() => handleSetPreferred(ms.supplier_id)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {ms.supplier_name}
                        {ms.is_preferred && (
                          <Chip 
                            icon={<StarIcon />} 
                            label="Preferred" 
                            size="small" 
                            color="primary" 
                            sx={{ ml: 1 }} 
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography 
                          fontWeight={ms.is_preferred ? 'bold' : 'normal'}
                          color={ms.is_preferred ? 'primary' : 'inherit'}
                        >
                          ${ms.unit_cost.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          fontWeight={ms.is_preferred ? 'bold' : 'normal'}
                          color={ms.is_preferred ? 'primary' : 'inherit'}
                        >
                          ${ms.shipping_cost.toFixed(2)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          fontWeight={ms.is_preferred ? 'bold' : 'normal'}
                          color={ms.is_preferred ? 'primary' : 'inherit'}
                        >
                          {ms.quantity_purchased}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <IconButton 
                          size="small" 
                          color="error" 
                          onClick={() => handleRemoveSupplierLink(ms.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Box sx={{ mt: 2 }}>
            <Button
              startIcon={<AddIcon />}
              onClick={() => setAddSupplierDialogOpen(true)}
              disabled={availableSuppliers.length === 0}
            >
              Add Supplier
            </Button>
            {availableSuppliers.length === 0 && suppliers.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                All suppliers are already linked
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSupplierDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addSupplierDialogOpen} onClose={() => setAddSupplierDialogOpen(false)}>
        <DialogTitle>Add Supplier to {selectedMaterial?.name}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1, minWidth: 300 }}>
            <FormControl fullWidth>
              <InputLabel>Supplier</InputLabel>
              <Select
                value={newSupplierLink.supplier_id || ''}
                label="Supplier"
                onChange={(e) => setNewSupplierLink({ ...newSupplierLink, supplier_id: e.target.value as number })}
              >
                {availableSuppliers.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={selectedMaterial?.material_type === 'fabric' ? 'Unit Cost ($ per yard)' : 'Unit Cost ($)'}
              type="number"
              value={newSupplierLink.unit_cost}
              onChange={(e) => setNewSupplierLink({ ...newSupplierLink, unit_cost: parseFloat(e.target.value) || 0 })}
              fullWidth
            />
            <TextField
              label="Shipping Cost ($)"
              type="number"
              value={newSupplierLink.shipping_cost}
              onChange={(e) => setNewSupplierLink({ ...newSupplierLink, shipping_cost: parseFloat(e.target.value) || 0 })}
              fullWidth
              helperText={`Flat shipping cost - will be divided by ${selectedMaterial?.material_type === 'fabric' ? 'yards' : 'quantity'} purchased`}
            />
            <TextField
              label={selectedMaterial?.material_type === 'fabric' ? 'Yards Purchased' : 'Quantity Purchased'}
              type="number"
              value={newSupplierLink.quantity_purchased}
              onChange={(e) => setNewSupplierLink({ ...newSupplierLink, quantity_purchased: parseFloat(e.target.value) || 1 })}
              fullWidth
              helperText={selectedMaterial?.material_type === 'fabric' 
                ? 'Number of yards in this purchase (for shipping cost calculation)'
                : 'Number of units/packages purchased'}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSupplierDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAddSupplierLink} 
            variant="contained"
            disabled={!newSupplierLink.supplier_id}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
