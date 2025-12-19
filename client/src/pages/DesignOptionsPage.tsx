import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { designOptionsApi } from '../services/api'
import type { DesignOption } from '../types'

export default function DesignOptionsPage() {
  const [designOptions, setDesignOptions] = useState<DesignOption[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DesignOption | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const loadDesignOptions = async () => {
    const data = await designOptionsApi.list()
    setDesignOptions(data)
  }

  useEffect(() => {
    loadDesignOptions()
  }, [])

  const handleOpenDialog = (option?: DesignOption) => {
    if (option) {
      setEditing(option)
      setName(option.name)
      setDescription(option.description || '')
    } else {
      setEditing(null)
      setName('')
      setDescription('')
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const data = { name, description: description || undefined }
    if (editing) {
      await designOptionsApi.update(editing.id, data)
    } else {
      await designOptionsApi.create(data)
    }
    setDialogOpen(false)
    loadDesignOptions()
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this design option?')) {
      await designOptionsApi.delete(id)
      loadDesignOptions()
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Design Options</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Design Option
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Design options are features that affect how models are configured (e.g., Handle Options, Angle Options).
          They can be assigned to equipment types to indicate which design features apply.
        </Typography>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {designOptions.map((option) => (
              <TableRow key={option.id}>
                <TableCell>{option.name}</TableCell>
                <TableCell>{option.description || '-'}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpenDialog(option)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(option.id)} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {designOptions.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  No design options found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Design Option' : 'Add Design Option'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
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
