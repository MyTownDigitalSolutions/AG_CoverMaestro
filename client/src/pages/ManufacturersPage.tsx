import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, List, ListItem, ListItemText,
  ListItemSecondaryAction, Divider, Chip, Grid
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { manufacturersApi, seriesApi } from '../services/api'
import type { Manufacturer, Series } from '../types'

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [selectedManufacturer, setSelectedManufacturer] = useState<Manufacturer | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [seriesDialogOpen, setSeriesDialogOpen] = useState(false)
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null)
  const [name, setName] = useState('')
  const [seriesName, setSeriesName] = useState('')

  const loadManufacturers = async () => {
    const data = await manufacturersApi.list()
    setManufacturers(data)
  }

  const loadSeries = async (manufacturerId: number) => {
    const data = await seriesApi.list(manufacturerId)
    setSeries(data)
  }

  useEffect(() => {
    loadManufacturers()
  }, [])

  useEffect(() => {
    if (selectedManufacturer) {
      loadSeries(selectedManufacturer.id)
    }
  }, [selectedManufacturer])

  const handleSave = async () => {
    if (editingManufacturer) {
      await manufacturersApi.update(editingManufacturer.id, { name })
    } else {
      await manufacturersApi.create({ name })
    }
    setDialogOpen(false)
    setName('')
    setEditingManufacturer(null)
    loadManufacturers()
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this manufacturer?')) {
      await manufacturersApi.delete(id)
      loadManufacturers()
      if (selectedManufacturer?.id === id) {
        setSelectedManufacturer(null)
        setSeries([])
      }
    }
  }

  const handleAddSeries = async () => {
    if (selectedManufacturer) {
      await seriesApi.create({ name: seriesName, manufacturer_id: selectedManufacturer.id })
      setSeriesDialogOpen(false)
      setSeriesName('')
      loadSeries(selectedManufacturer.id)
    }
  }

  const handleDeleteSeries = async (id: number) => {
    if (confirm('Are you sure you want to delete this series?')) {
      await seriesApi.delete(id)
      if (selectedManufacturer) {
        loadSeries(selectedManufacturer.id)
      }
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Manufacturers & Series</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingManufacturer(null)
            setName('')
            setDialogOpen(true)
          }}
        >
          Add Manufacturer
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Manufacturers</Typography>
            <List>
              {manufacturers.map((manufacturer) => (
                <ListItem
                  key={manufacturer.id}
                  button
                  selected={selectedManufacturer?.id === manufacturer.id}
                  onClick={() => setSelectedManufacturer(manufacturer)}
                >
                  <ListItemText primary={manufacturer.name} />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => {
                        setEditingManufacturer(manufacturer)
                        setName(manufacturer.name)
                        setDialogOpen(true)
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton edge="end" onClick={() => handleDelete(manufacturer.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Series {selectedManufacturer && `for ${selectedManufacturer.name}`}
              </Typography>
              {selectedManufacturer && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setSeriesDialogOpen(true)}
                >
                  Add Series
                </Button>
              )}
            </Box>
            {selectedManufacturer ? (
              <List>
                {series.map((s) => (
                  <ListItem key={s.id}>
                    <ListItemText primary={s.name} />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleDeleteSeries(s.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
                {series.length === 0 && (
                  <Typography color="text.secondary" sx={{ p: 2 }}>
                    No series found. Add one to get started.
                  </Typography>
                )}
              </List>
            ) : (
              <Typography color="text.secondary" sx={{ p: 2 }}>
                Select a manufacturer to view its series
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>
          {editingManufacturer ? 'Edit Manufacturer' : 'Add Manufacturer'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={seriesDialogOpen} onClose={() => setSeriesDialogOpen(false)}>
        <DialogTitle>Add Series</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Series Name"
            fullWidth
            value={seriesName}
            onChange={(e) => setSeriesName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeriesDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddSeries} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
