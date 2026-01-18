import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Alert,
  FormControl, InputLabel, Select, MenuItem, Radio, Checkbox
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import StarIcon from '@mui/icons-material/Star'
import PaletteIcon from '@mui/icons-material/Palette'
import { materialsApi, suppliersApi } from '../services/api'
import type { Material, Supplier, SupplierMaterialWithSupplier, MaterialType, UnitOfMeasure, MaterialColourSurcharge } from '../types'

/*
 * UI WORK LOG - 2025-12-24
 * -------------------------
 * - Implemented Sidebar Navigation Restructuring:
 *   - Created "Pricing / Calculation Settings" collapsible group.
 *   - Created "Suppliers / Materials" collapsible group.
 *   - Removed root-level items for cleanup.
 * - Implemented Hub Pages:
 *   - Created PricingCalculationSettingsPage (Hub for Pricing).
 *   - Created SuppliersMaterialsPage (Hub for Suppliers/Materials).
 * - Implemented Deep Linking:
 *   - Added "Material Role Assignments" section to Materials Page (embedding existing Settings UI).
 *   - Added deep-link anchor (#material-roles) with auto-scroll.
 *   - Updated Hub Page to link directly to this anchor.
 *
 * This comment serves as the authoritative record of changes due to task numbering drift.
 */


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

  // Color surcharge state
  const [surchargeDialogOpen, setSurchargeDialogOpen] = useState(false)
  const [surcharges, setSurcharges] = useState<MaterialColourSurcharge[]>([])
  const [selectedMaterialForSurcharge, setSelectedMaterialForSurcharge] = useState<Material | null>(null)
  const [editingSurcharge, setEditingSurcharge] = useState<MaterialColourSurcharge | null>(null)
  const [surchargeFormData, setSurchargeFormData] = useState({
    colour: '',
    surcharge: 0,
    color_friendly_name: '',
    sku_abbreviation: '',
    ebay_variation_enabled: false
  })



  // Delete confirmation state
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [materialToDelete, setMaterialToDelete] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    base_color: '',
    material_type: 'fabric' as MaterialType,
    linear_yard_width: 54 as number | undefined,
    weight_per_linear_yard: 0 as number | undefined,
    unit_of_measure: 'yard' as UnitOfMeasure | undefined,
    package_quantity: undefined as number | undefined,
    sku_abbreviation: '' as string | undefined,
    ebay_variation_enabled: false
  })

  const loadMaterials = async () => {
    try {
      const data = await materialsApi.list()
      setMaterials(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load materials')
    }
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

  const handleDeleteClick = (id: number) => {
    setMaterialToDelete(id)
    setDeleteConfirmationOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (materialToDelete !== null) {
      try {
        await materialsApi.delete(materialToDelete)
        loadMaterials()
        setDeleteConfirmationOpen(false)
        setMaterialToDelete(null)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to delete material')
        setDeleteConfirmationOpen(false)
      }
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      base_color: '',
      material_type: 'fabric' as MaterialType,
      linear_yard_width: 54,
      weight_per_linear_yard: 0,
      unit_of_measure: 'yard' as UnitOfMeasure,
      package_quantity: undefined,
      sku_abbreviation: '',
      ebay_variation_enabled: false
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
      weight_per_linear_yard: material.weight_per_linear_yard,
      unit_of_measure: material.unit_of_measure,
      package_quantity: material.package_quantity,
      sku_abbreviation: material.sku_abbreviation || '',
      ebay_variation_enabled: material.ebay_variation_enabled || false
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

  const openSurchargeDialog = async (material: Material) => {
    setSelectedMaterialForSurcharge(material)
    setEditingSurcharge(null)
    setSurchargeFormData({
      colour: '',
      surcharge: 0,
      color_friendly_name: '',
      sku_abbreviation: '',
      ebay_variation_enabled: false
    })
    try {
      const data = await materialsApi.listSurcharges(material.id)
      setSurcharges(data)
      setSurchargeDialogOpen(true)
    } catch (err) {
      setError('Failed to load surcharges for this material')
    }
  }

  const openEditSurcharge = (surcharge: MaterialColourSurcharge) => {
    setEditingSurcharge(surcharge)
    setSurchargeFormData({
      colour: surcharge.colour,
      surcharge: surcharge.surcharge,
      color_friendly_name: surcharge.color_friendly_name || '',
      sku_abbreviation: surcharge.sku_abbreviation || '',
      ebay_variation_enabled: surcharge.ebay_variation_enabled || false
    })
  }

  const handleSaveSurcharge = async () => {
    if (!selectedMaterialForSurcharge) return

    try {
      if (editingSurcharge) {
        await materialsApi.updateSurcharge(editingSurcharge.id, {
          colour: surchargeFormData.colour,
          surcharge: surchargeFormData.surcharge,
          color_friendly_name: surchargeFormData.color_friendly_name || undefined,
          sku_abbreviation: surchargeFormData.sku_abbreviation || undefined,
          ebay_variation_enabled: surchargeFormData.ebay_variation_enabled
        })
      } else {
        await materialsApi.createSurcharge({
          material_id: selectedMaterialForSurcharge.id,
          colour: surchargeFormData.colour,
          surcharge: surchargeFormData.surcharge,
          color_friendly_name: surchargeFormData.color_friendly_name || undefined,
          sku_abbreviation: surchargeFormData.sku_abbreviation || undefined,
          ebay_variation_enabled: surchargeFormData.ebay_variation_enabled
        })
      }

      const data = await materialsApi.listSurcharges(selectedMaterialForSurcharge.id)
      setSurcharges(data)

      // Reset form
      setEditingSurcharge(null)
      setSurchargeFormData({
        colour: '',
        surcharge: 0,
        color_friendly_name: '',
        sku_abbreviation: '',
        ebay_variation_enabled: false
      })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save color surcharge')
    }
  }

  const handleDeleteSurcharge = async (surchargeId: number) => {
    if (!window.confirm('Delete this color surcharge?')) return
    try {
      await materialsApi.deleteSurcharge(surchargeId)
      if (selectedMaterialForSurcharge) {
        const data = await materialsApi.listSurcharges(selectedMaterialForSurcharge.id)
        setSurcharges(data)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete surcharge')
    }
  }

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
              <TableCell>SKU Abbrev</TableCell>
              <TableCell>Base Color</TableCell>
              <TableCell>Width (in)</TableCell>
              <TableCell>Weight/Yard (oz)</TableCell>
              <TableCell>Weight/Sq In (oz)</TableCell>
              <TableCell>Pkg Qty</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materials.map((material) => {
              const isFabric = material.material_type === 'fabric'
              const width = material.linear_yard_width || 0
              const weight = material.weight_per_linear_yard || 0
              const weightPerSqIn = width > 0 && weight > 0
                ? weight / (width * 36)
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
                  <TableCell>
                    {(() => {
                      const abbrev = material.sku_abbreviation?.trim()
                      if (!abbrev) return '-'
                      if (abbrev.length > 3) return `${abbrev} (invalid; max 3)`
                      return abbrev
                    })()}
                  </TableCell>
                  <TableCell>{material.base_color}</TableCell>
                  <TableCell>{isFabric ? width : '-'}</TableCell>
                  <TableCell>{isFabric ? weight : '-'}</TableCell>
                  <TableCell>{isFabric ? weightPerSqIn.toFixed(4) : '-'}</TableCell>
                  <TableCell>{!isFabric && material.package_quantity ? material.package_quantity : '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={() => openSurchargeDialog(material)}
                      title="Manage Color Surcharges"
                      color="secondary"
                    >
                      <PaletteIcon />
                    </IconButton>
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
                    <IconButton
                      onClick={() => handleDeleteClick(material.id)}
                      title="Delete"
                      color="error"
                      type="button"
                    >
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
                    label="Weight per Linear Yard (oz)"
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
                label="SKU Abbreviation"
                value={formData.sku_abbreviation || ''}
                onChange={(e) => setFormData({ ...formData, sku_abbreviation: e.target.value })}
                inputProps={{ maxLength: 3 }}
                helperText="Max 3 characters for eBay variation SKUs"
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth sx={{ mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={formData.ebay_variation_enabled}
                    onChange={(e) => setFormData({ ...formData, ebay_variation_enabled: e.target.checked })}
                  />
                  <Typography>eBay Variation Enabled</Typography>
                </Box>
              </FormControl>
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
            {materialSuppliers.length <= 1
              ? "This material has one supplier. Their cost will be used automatically for pricing."
              : "Multiple suppliers exist. Please select a preferred supplier - their cost will be used for pricing calculations."}
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

      <Dialog
        open={addSupplierDialogOpen}
        onClose={() => setAddSupplierDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Link Supplier</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Supplier</InputLabel>
                <Select
                  value={newSupplierLink.supplier_id || ''}
                  label="Supplier"
                  onChange={(e) => setNewSupplierLink({ ...newSupplierLink, supplier_id: Number(e.target.value) })}
                >
                  {availableSuppliers.map(s => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Unit Cost"
                value={newSupplierLink.unit_cost}
                onChange={(e) => setNewSupplierLink({ ...newSupplierLink, unit_cost: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Shipping Cost (Total)"
                value={newSupplierLink.shipping_cost}
                onChange={(e) => setNewSupplierLink({ ...newSupplierLink, shipping_cost: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="number"
                label={selectedMaterial?.material_type === 'fabric' ? "Yards Purchased (for shipping calc)" : "Quantity Purchased"}
                value={newSupplierLink.quantity_purchased}
                onChange={(e) => setNewSupplierLink({ ...newSupplierLink, quantity_purchased: parseFloat(e.target.value) || 1 })}
                helperText="Used to amortize shipping cost per unit"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSupplierDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddSupplierLink} variant="contained" disabled={!newSupplierLink.supplier_id}>
            Link Supplier
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={surchargeDialogOpen}
        onClose={() => setSurchargeDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Color Surcharges for {selectedMaterialForSurcharge?.name}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mb: 4, mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                {editingSurcharge ? 'Edit Surcharge' : 'Add New Surcharge'}
              </Typography>
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                size="small"
                label="Color Name (Internal)"
                value={surchargeFormData.colour}
                onChange={(e) => setSurchargeFormData({ ...surchargeFormData, colour: e.target.value })}
                placeholder="e.g. Navy Blue"
              />
            </Grid>
            <Grid item xs={3}>
              <TextField
                fullWidth
                size="small"
                label="Friendly Name"
                value={surchargeFormData.color_friendly_name}
                onChange={(e) => setSurchargeFormData({ ...surchargeFormData, color_friendly_name: e.target.value })}
                placeholder="Public display name"
              />
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Surcharge"
                value={surchargeFormData.surcharge}
                onChange={(e) => setSurchargeFormData({ ...surchargeFormData, surcharge: parseFloat(e.target.value) || 0 })}
                InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, fontSize: '0.875rem' }}>$</Typography> }}
              />
            </Grid>
            <Grid item xs={2}>
              <TextField
                fullWidth
                size="small"
                label="SKU Abbrev"
                value={surchargeFormData.sku_abbreviation}
                onChange={(e) => setSurchargeFormData({ ...surchargeFormData, sku_abbreviation: e.target.value })}
                inputProps={{ maxLength: 3 }}
                placeholder="Max 3"
              />
            </Grid>
            <Grid item xs={2} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Checkbox
                    checked={surchargeFormData.ebay_variation_enabled}
                    onChange={(e) => setSurchargeFormData({ ...surchargeFormData, ebay_variation_enabled: e.target.checked })}
                    size="small"
                  />
                  <Typography variant="caption">eBay Var?</Typography>
                </Box>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSaveSurcharge}
                    disabled={!surchargeFormData.colour}
                    sx={{ minWidth: '60px' }}
                  >
                    {editingSurcharge ? 'Save' : 'Add'}
                  </Button>
                  {editingSurcharge && (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setEditingSurcharge(null)
                        setSurchargeFormData({
                          colour: '',
                          surcharge: 0,
                          color_friendly_name: '',
                          sku_abbreviation: '',
                          ebay_variation_enabled: false
                        })
                      }}
                      sx={{ minWidth: '60px' }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </Box>
            </Grid>
          </Grid>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Internal Color</TableCell>
                  <TableCell>Friendly Name</TableCell>
                  <TableCell>Surcharge</TableCell>
                  <TableCell>SKU Abbrev</TableCell>
                  <TableCell>eBay Var?</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {surcharges.map(s => (
                  <TableRow key={s.id} sx={editingSurcharge?.id === s.id ? { bgcolor: 'action.selected' } : {}}>
                    <TableCell>{s.colour}</TableCell>
                    <TableCell>{s.color_friendly_name || '-'}</TableCell>
                    <TableCell>${s.surcharge.toFixed(2)}</TableCell>
                    <TableCell>{s.sku_abbreviation || '-'}</TableCell>
                    <TableCell>{s.ebay_variation_enabled ? 'Yes' : '-'}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => openEditSurcharge(s)}
                        disabled={!!editingSurcharge} // Disable other edit buttons while editing
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSurcharge(s.id)}
                        disabled={!!editingSurcharge}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {surcharges.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">No surcharges added</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSurchargeDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmationOpen}
        onClose={() => setDeleteConfirmationOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this material?
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmationOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
