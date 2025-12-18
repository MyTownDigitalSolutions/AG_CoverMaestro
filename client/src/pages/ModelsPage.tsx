import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select,
  MenuItem, Grid, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { modelsApi, seriesApi, equipmentTypesApi, enumsApi, manufacturersApi } from '../services/api'
import type { Model, Series, EquipmentType, EnumValue, Manufacturer } from '../types'

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [handleLocations, setHandleLocations] = useState<EnumValue[]>([])
  const [angleTypes, setAngleTypes] = useState<EnumValue[]>([])
  const [filterSeries, setFilterSeries] = useState<number | ''>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    series_id: 0,
    equipment_type_id: 0,
    width: 0,
    depth: 0,
    height: 0,
    handle_length: 0,
    handle_width: 0,
    handle_location: 'none',
    angle_type: 'none',
    image_url: ''
  })

  const loadData = async () => {
    const [modelsData, seriesData, manufacturersData, equipmentTypesData, handleLocData, angleTypesData] = await Promise.all([
      modelsApi.list(filterSeries || undefined),
      seriesApi.list(),
      manufacturersApi.list(),
      equipmentTypesApi.list(),
      enumsApi.handleLocations(),
      enumsApi.angleTypes()
    ])
    setModels(modelsData)
    setSeries(seriesData)
    setManufacturers(manufacturersData)
    setEquipmentTypes(equipmentTypesData)
    setHandleLocations(handleLocData)
    setAngleTypes(angleTypesData)
  }

  useEffect(() => {
    loadData()
  }, [filterSeries])

  const getSeriesWithManufacturer = (seriesId: number) => {
    const s = series.find(x => x.id === seriesId)
    if (!s) return 'Unknown'
    const m = manufacturers.find(x => x.id === s.manufacturer_id)
    return m ? `${m.name} - ${s.name}` : s.name
  }

  const handleSave = async () => {
    const data = {
      ...formData,
      handle_length: formData.handle_length || undefined,
      handle_width: formData.handle_width || undefined,
      image_url: formData.image_url || undefined
    }
    
    if (editingModel) {
      await modelsApi.update(editingModel.id, data)
    } else {
      await modelsApi.create(data)
    }
    setDialogOpen(false)
    resetForm()
    loadData()
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this model?')) {
      await modelsApi.delete(id)
      loadData()
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      series_id: 0,
      equipment_type_id: 0,
      width: 0,
      depth: 0,
      height: 0,
      handle_length: 0,
      handle_width: 0,
      handle_location: 'none',
      angle_type: 'none',
      image_url: ''
    })
    setEditingModel(null)
  }

  const openEdit = (model: Model) => {
    setEditingModel(model)
    setFormData({
      name: model.name,
      series_id: model.series_id,
      equipment_type_id: model.equipment_type_id,
      width: model.width,
      depth: model.depth,
      height: model.height,
      handle_length: model.handle_length || 0,
      handle_width: model.handle_width || 0,
      handle_location: model.handle_location,
      angle_type: model.angle_type,
      image_url: model.image_url || ''
    })
    setDialogOpen(true)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Models</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            resetForm()
            setDialogOpen(true)
          }}
        >
          Add Model
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Series</InputLabel>
          <Select
            value={filterSeries}
            label="Filter by Series"
            onChange={(e) => setFilterSeries(e.target.value as number | '')}
          >
            <MenuItem value="">All Series</MenuItem>
            {series.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {getSeriesWithManufacturer(s.id)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Parent SKU</TableCell>
              <TableCell>Series</TableCell>
              <TableCell>Dimensions (W x D x H)</TableCell>
              <TableCell>Handle</TableCell>
              <TableCell>Angle</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell>{model.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{model.parent_sku || '-'}</TableCell>
                <TableCell>{getSeriesWithManufacturer(model.series_id)}</TableCell>
                <TableCell>{`${model.width}" x ${model.depth}" x ${model.height}"`}</TableCell>
                <TableCell>{model.handle_location}</TableCell>
                <TableCell>{model.angle_type}</TableCell>
                <TableCell>
                  <IconButton onClick={() => openEdit(model)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(model.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            resize: 'both',
            overflow: 'auto',
            minWidth: 400,
            minHeight: 300
          }
        }}
      >
        <DialogTitle>{editingModel ? 'Edit Model' : 'Add Model'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Series</InputLabel>
                <Select
                  value={formData.series_id || ''}
                  label="Series"
                  onChange={(e) => setFormData({ ...formData, series_id: e.target.value as number })}
                >
                  {series.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {getSeriesWithManufacturer(s.id)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {formData.series_id > 0 && (
                <Box sx={{ mt: 1, pl: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Existing models in this series:
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                    {models
                      .filter(m => m.series_id === formData.series_id && m.id !== editingModel?.id)
                      .map(m => m.name)
                      .join(', ') || 'None yet'}
                  </Typography>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Model Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Equipment Type</InputLabel>
                <Select
                  value={formData.equipment_type_id || ''}
                  label="Equipment Type"
                  onChange={(e) => setFormData({ ...formData, equipment_type_id: e.target.value as number })}
                >
                  {equipmentTypes.map((et) => (
                    <MenuItem key={et.id} value={et.id}>{et.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Width (inches)"
                value={formData.width}
                onChange={(e) => setFormData({ ...formData, width: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Depth (inches)"
                value={formData.depth}
                onChange={(e) => setFormData({ ...formData, depth: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Height (inches)"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Handle Location</InputLabel>
                <Select
                  value={formData.handle_location}
                  label="Handle Location"
                  onChange={(e) => setFormData({ ...formData, handle_location: e.target.value })}
                >
                  {handleLocations.map((hl) => (
                    <MenuItem key={hl.value} value={hl.value}>{hl.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Angle Type</InputLabel>
                <Select
                  value={formData.angle_type}
                  label="Angle Type"
                  onChange={(e) => setFormData({ ...formData, angle_type: e.target.value })}
                >
                  {angleTypes.map((at) => (
                    <MenuItem key={at.value} value={at.value}>{at.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Image URL"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
