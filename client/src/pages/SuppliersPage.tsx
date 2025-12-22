import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, CircularProgress
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import { suppliersApi } from '../services/api'
import type { Supplier } from '../types'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
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

  useEffect(() => {
    loadSuppliers()
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
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
                      <IconButton size="small" onClick={() => handleOpenDialog(supplier)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(supplier.id)}>
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
