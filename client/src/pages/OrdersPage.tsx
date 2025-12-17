import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, FormControl, InputLabel, Select,
  MenuItem, Grid, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { ordersApi, customersApi, enumsApi } from '../services/api'
import type { Order, Customer, EnumValue } from '../types'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [marketplaces, setMarketplaces] = useState<EnumValue[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    customer_id: 0,
    marketplace: '',
    marketplace_order_number: ''
  })

  const loadData = async () => {
    const [ordersData, customersData, marketplacesData] = await Promise.all([
      ordersApi.list(),
      customersApi.list(),
      enumsApi.marketplaces()
    ])
    setOrders(ordersData)
    setCustomers(customersData)
    setMarketplaces(marketplacesData)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSave = async () => {
    await ordersApi.create({
      customer_id: formData.customer_id,
      marketplace: formData.marketplace || undefined,
      marketplace_order_number: formData.marketplace_order_number || undefined,
      order_lines: []
    })
    setDialogOpen(false)
    resetForm()
    loadData()
  }

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this order?')) {
      await ordersApi.delete(id)
      loadData()
    }
  }

  const resetForm = () => {
    setFormData({
      customer_id: 0,
      marketplace: '',
      marketplace_order_number: ''
    })
  }

  const getCustomerName = (customerId: number) => {
    const customer = customers.find(c => c.id === customerId)
    return customer?.name || 'Unknown'
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Orders</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            resetForm()
            setDialogOpen(true)
          }}
        >
          Create Order
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Order ID</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Marketplace</TableCell>
              <TableCell>Order Number</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>#{order.id}</TableCell>
                <TableCell>{getCustomerName(order.customer_id)}</TableCell>
                <TableCell>{order.marketplace || '-'}</TableCell>
                <TableCell>{order.marketplace_order_number || '-'}</TableCell>
                <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                <TableCell>{order.order_lines?.length || 0}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleDelete(order.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No orders yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Order</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Customer</InputLabel>
                <Select
                  value={formData.customer_id || ''}
                  label="Customer"
                  onChange={(e) => setFormData({ ...formData, customer_id: e.target.value as number })}
                >
                  {customers.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Marketplace</InputLabel>
                <Select
                  value={formData.marketplace}
                  label="Marketplace"
                  onChange={(e) => setFormData({ ...formData, marketplace: e.target.value })}
                >
                  <MenuItem value="">None</MenuItem>
                  {marketplaces.map((m) => (
                    <MenuItem key={m.value} value={m.value}>{m.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Marketplace Order Number"
                value={formData.marketplace_order_number}
                onChange={(e) => setFormData({ ...formData, marketplace_order_number: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.customer_id}>
            Create Order
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
