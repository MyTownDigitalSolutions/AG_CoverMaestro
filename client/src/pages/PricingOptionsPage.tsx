import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, InputAdornment, Checkbox, FormControlLabel,
  FormControl, InputLabel, Select, MenuItem
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import { pricingApi, designOptionsApi } from '../services/api'
import type { PricingOption, DesignOption } from '../types'

export default function PricingOptionsPage() {
  const [pricingOptions, setPricingOptions] = useState<PricingOption[]>([])
  const [designOptions, setDesignOptions] = useState<DesignOption[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PricingOption | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [skuAbbreviation, setSkuAbbreviation] = useState('')
  const [ebayVariationEnabled, setEbayVariationEnabled] = useState(false)
  const [linkedDesignOptionId, setLinkedDesignOptionId] = useState<number | ''>('')

  const loadPricingOptions = async () => {
    const data = await pricingApi.listOptions()
    setPricingOptions(data)
  }

  const loadDesignOptions = async () => {
    const data = await designOptionsApi.list()
    setDesignOptions(data)
  }

  useEffect(() => {
    loadPricingOptions()
    loadDesignOptions()
  }, [])

  const handleOpenDialog = (option?: PricingOption) => {
    if (option) {
      setEditing(option)
      setName(option.name)
      setPrice(option.price.toString())
      setSkuAbbreviation(option.sku_abbreviation || '')
      setEbayVariationEnabled(option.ebay_variation_enabled || false)
      setLinkedDesignOptionId(option.linked_design_option_id || '')
    } else {
      setEditing(null)
      setName('')
      setPrice('')
      setSkuAbbreviation('')
      setEbayVariationEnabled(false)
      setLinkedDesignOptionId('')
    }
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const data = {
      name,
      price: parseFloat(price) || 0,
      sku_abbreviation: skuAbbreviation || undefined,
      ebay_variation_enabled: ebayVariationEnabled,
      linked_design_option_id: linkedDesignOptionId || null
    }
    if (editing) {
      await pricingApi.updateOption(editing.id, data)
    } else {
      await pricingApi.createOption(data)
    }
    setDialogOpen(false)
    loadPricingOptions()
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this pricing option?')) {
      await pricingApi.deleteOption(id)
      loadPricingOptions()
    }
  }

  // Compute link status for validation warnings
  const getLinkStatus = (option: PricingOption): string => {
    if (!option.linked_design_option_id || !option.linked_design_option) {
      return '—'
    }

    const warnings: string[] = []
    const linkedDO = option.linked_design_option

    // Check if pricing option enabled but abbrev missing/invalid (1-3 chars)
    if (option.ebay_variation_enabled) {
      const abbrev = option.sku_abbreviation?.trim()
      if (!abbrev || abbrev.length < 1 || abbrev.length > 3) {
        warnings.push('PO abbrev invalid')
      }
    }

    // Check if linked design option enabled but abbrev missing/invalid (1-3 chars)
    if (linkedDO.ebay_variation_enabled) {
      const abbrev = linkedDO.sku_abbreviation?.trim()
      if (!abbrev || abbrev.length < 1 || abbrev.length > 3) {
        warnings.push('DO abbrev invalid')
      }
    }

    // Check if enabled flags mismatch
    if (option.ebay_variation_enabled !== linkedDO.ebay_variation_enabled) {
      warnings.push('enabled mismatch')
    }

    if (warnings.length > 0) {
      return `WARN: ${warnings.join(', ')}`
    }

    return 'OK'
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Pricing Options</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Add Pricing Option
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pricing options are add-on features that can be assigned to equipment types.
        When creating or editing an equipment type, you can select which pricing options apply.
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell>SKU Abbrev</TableCell>
              <TableCell>eBay Var Enabled</TableCell>
              <TableCell>Linked Design Option</TableCell>
              <TableCell>Link Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pricingOptions.map((option) => (
              <TableRow key={option.id}>
                <TableCell>{option.name}</TableCell>
                <TableCell align="right">${option.price.toFixed(2)}</TableCell>
                <TableCell>{option.sku_abbreviation || '-'}</TableCell>
                <TableCell>{option.ebay_variation_enabled ? 'Yes' : 'No'}</TableCell>
                <TableCell>
                  {option.linked_design_option_id
                    ? designOptions.find(opt => opt.id === option.linked_design_option_id)?.name || `ID: ${option.linked_design_option_id}`
                    : '-'
                  }
                </TableCell>
                <TableCell>
                  {getLinkStatus(option)}
                </TableCell>
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
            {pricingOptions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No pricing options found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Pricing Option' : 'Add Pricing Option'}</DialogTitle>
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
            label="Price"
            type="number"
            fullWidth
            value={price}
            disabled={!!linkedDesignOptionId}
            onChange={(e) => setPrice(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">$</InputAdornment>
            }}
            helperText={linkedDesignOptionId ? "Price is managed on the linked Product Design Option" : undefined}
          />
          <TextField
            margin="dense"
            label="SKU Abbreviation"
            fullWidth
            value={skuAbbreviation}
            onChange={(e) => setSkuAbbreviation(e.target.value.toUpperCase())}
            inputProps={{ maxLength: 3 }}
            placeholder="ABC"
            helperText="For eBay variations: 1-3 uppercase characters max"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={ebayVariationEnabled}
                onChange={(e) => setEbayVariationEnabled(e.target.checked)}
              />
            }
            label="eBay Variation Enabled"
            sx={{ mt: 1 }}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Linked Design Option (optional)</InputLabel>
            <Select
              value={linkedDesignOptionId}
              label="Linked Design Option (optional)"
              onChange={(e) => setLinkedDesignOptionId(e.target.value as number | '')}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {designOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Show linked design option details when selected */}
          {linkedDesignOptionId && (() => {
            const linkedOpt = designOptions.find(opt => opt.id === linkedDesignOptionId)
            if (!linkedOpt) return null
            return (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Linked Design Option Details:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Abbrev: {linkedOpt.sku_abbreviation || '(missing)'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  eBay Enabled: {linkedOpt.ebay_variation_enabled ? 'Yes' : 'No'}
                </Typography>
              </Box>
            )
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!name.trim() || !price || parseFloat(price) < 0}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
