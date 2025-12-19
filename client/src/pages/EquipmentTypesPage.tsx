import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Switch, FormControlLabel
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { equipmentTypesApi } from '../services/api'
import type { EquipmentType } from '../types'

export default function EquipmentTypesPage() {
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EquipmentType | null>(null)
  const [name, setName] = useState('')
  const [usesHandleOptions, setUsesHandleOptions] = useState(false)
  const [usesAngleOptions, setUsesAngleOptions] = useState(false)

  const loadEquipmentTypes = async () => {
    const data = await equipmentTypesApi.list()
    setEquipmentTypes(data)
  }

  useEffect(() => {
    loadEquipmentTypes()
  }, [])

  const handleOpenDialog = (equipmentType?: EquipmentType) => {
    if (equipmentType) {
      setEditing(equipmentType)
      setName(equipmentType.name)
      setUsesHandleOptions(equipmentType.uses_handle_options)
      setUsesAngleOptions(equipmentType.uses_angle_options)
    } else {
      setEditing(null)
      setName('')
      setUsesHandleOptions(false)
      setUsesAngleOptions(false)
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const data = {
      name,
      uses_handle_options: usesHandleOptions,
      uses_angle_options: usesAngleOptions
    }
    if (editing) {
      await equipmentTypesApi.update(editing.id, data)
    } else {
      await equipmentTypesApi.create(data)
    }
    setDialogOpen(false)
    loadEquipmentTypes()
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this equipment type?')) {
      await equipmentTypesApi.delete(id)
      loadEquipmentTypes()
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Equipment Types</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Equipment Type
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="center">Uses Handle Options</TableCell>
              <TableCell align="center">Uses Angle Options</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {equipmentTypes.map((et) => (
              <TableRow key={et.id}>
                <TableCell>{et.name}</TableCell>
                <TableCell align="center">{et.uses_handle_options ? 'Yes' : 'No'}</TableCell>
                <TableCell align="center">{et.uses_angle_options ? 'Yes' : 'No'}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpenDialog(et)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(et.id)} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {equipmentTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No equipment types found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Equipment Type' : 'Add Equipment Type'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={usesHandleOptions}
                  onChange={(e) => setUsesHandleOptions(e.target.checked)}
                />
              }
              label="Uses Handle Options"
            />
          </Box>
          <Box sx={{ mt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={usesAngleOptions}
                  onChange={(e) => setUsesAngleOptions(e.target.checked)}
                />
              }
              label="Uses Angle Options"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
