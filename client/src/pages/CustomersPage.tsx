import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, Grid, IconButton, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { customersApi } from '../services/api'
import type { Customer } from '../types'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: ''
  })

  const loadCustomers = async () => {
    const data = await customersApi.list()
    setCustomers(data)
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const handleSave = async () => {
    if (editingCustomer) {
      await customersApi.update(editingCustomer.id, formData)
    } else {
      await customersApi.create(formData)
    }
    setDialogOpen(false)
    resetForm()
    loadCustomers()
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this customer?')) {
      await customersApi.delete(id)
      loadCustomers()
    }
  }

  const resetForm = () => {
    setFormData({ name: '', address: '', phone: '' })
    setEditingCustomer(null)
  }

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      address: customer.address || '',
      phone: customer.phone || ''
    })
    setDialogOpen(true)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Customers</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            resetForm()
            setDialogOpen(true)
          }}
        >
          Add Customer
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Address</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.name}</TableCell>
                <TableCell>{customer.address || '-'}</TableCell>
                <TableCell>{customer.phone || '-'}</TableCell>
                <TableCell>
                  <IconButton onClick={() => openEdit(customer)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(customer.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                multiline
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
