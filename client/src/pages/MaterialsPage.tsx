import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { materialsApi } from '../services/api'
import type { Material } from '../types'

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    base_color: '',
    linear_yard_width: 54,
    cost_per_linear_yard: 0,
    weight_per_linear_yard: 0,
    labor_time_minutes: 45
  })

  const loadMaterials = async () => {
    const data = await materialsApi.list()
    setMaterials(data)
  }

  useEffect(() => {
    loadMaterials()
  }, [])

  const handleSave = async () => {
    if (editingMaterial) {
      await materialsApi.update(editingMaterial.id, formData)
    } else {
      await materialsApi.create(formData)
    }
    setDialogOpen(false)
    resetForm()
    loadMaterials()
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
      linear_yard_width: 54,
      cost_per_linear_yard: 0,
      weight_per_linear_yard: 0,
      labor_time_minutes: 45
    })
    setEditingMaterial(null)
  }

  const openEdit = (material: Material) => {
    setEditingMaterial(material)
    setFormData({
      name: material.name,
      base_color: material.base_color,
      linear_yard_width: material.linear_yard_width,
      cost_per_linear_yard: material.cost_per_linear_yard,
      weight_per_linear_yard: material.weight_per_linear_yard,
      labor_time_minutes: material.labor_time_minutes
    })
    setDialogOpen(true)
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Base Color</TableCell>
              <TableCell>Width (in)</TableCell>
              <TableCell>Cost/Yard</TableCell>
              <TableCell>Weight/Yard</TableCell>
              <TableCell>Labor (min)</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {materials.map((material) => (
              <TableRow key={material.id}>
                <TableCell>{material.name}</TableCell>
                <TableCell>{material.base_color}</TableCell>
                <TableCell>{material.linear_yard_width}</TableCell>
                <TableCell>${material.cost_per_linear_yard.toFixed(2)}</TableCell>
                <TableCell>{material.weight_per_linear_yard} lbs</TableCell>
                <TableCell>{material.labor_time_minutes}</TableCell>
                <TableCell>
                  <IconButton onClick={() => openEdit(material)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(material.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
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
              <TextField
                fullWidth
                label="Base Color"
                value={formData.base_color}
                onChange={(e) => setFormData({ ...formData, base_color: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Width (inches)"
                value={formData.linear_yard_width}
                onChange={(e) => setFormData({ ...formData, linear_yard_width: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Cost per Linear Yard ($)"
                value={formData.cost_per_linear_yard}
                onChange={(e) => setFormData({ ...formData, cost_per_linear_yard: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Weight per Linear Yard (lbs)"
                value={formData.weight_per_linear_yard}
                onChange={(e) => setFormData({ ...formData, weight_per_linear_yard: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={12}>
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
    </Box>
  )
}
