import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, FormControl, InputLabel, Select, MenuItem,
  Grid, TextField, FormControlLabel, Checkbox, Button, Divider, Alert
} from '@mui/material'
import CalculateIcon from '@mui/icons-material/Calculate'
import { modelsApi, materialsApi, pricingApi, enumsApi, seriesApi, manufacturersApi } from '../services/api'
import type { Model, Material, PricingResult, EnumValue, Series, Manufacturer } from '../types'

export default function PricingCalculator() {
  const [models, setModels] = useState<Model[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [carriers, setCarriers] = useState<EnumValue[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [result, setResult] = useState<PricingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    model_id: 0,
    material_id: 0,
    colour: '',
    quantity: 1,
    handle_zipper: false,
    two_in_one_pocket: false,
    music_rest_zipper: false,
    carrier: 'usps',
    zone: '1'
  })

  useEffect(() => {
    const loadData = async () => {
      const [modelsData, materialsData, carriersData, seriesData, manufacturersData] = await Promise.all([
        modelsApi.list(),
        materialsApi.list(),
        enumsApi.carriers(),
        seriesApi.list(),
        manufacturersApi.list()
      ])
      setModels(modelsData)
      setMaterials(materialsData)
      setCarriers(carriersData)
      setSeries(seriesData)
      setManufacturers(manufacturersData)
    }
    loadData()
  }, [])

  const getModelDisplay = (model: Model) => {
    const s = series.find(x => x.id === model.series_id)
    const m = s ? manufacturers.find(x => x.id === s.manufacturer_id) : null
    const prefix = m && s ? `${m.name} ${s.name}` : ''
    return `${prefix} ${model.name} (${model.width}" x ${model.depth}" x ${model.height}")`
  }

  const handleCalculate = async () => {
    setError(null)
    setResult(null)

    if (!formData.model_id || !formData.material_id) {
      setError('Please select a model and material')
      return
    }

    try {
      const data = await pricingApi.calculate({
        model_id: formData.model_id,
        material_id: formData.material_id,
        colour: formData.colour || undefined,
        quantity: formData.quantity,
        handle_zipper: formData.handle_zipper,
        two_in_one_pocket: formData.two_in_one_pocket,
        music_rest_zipper: formData.music_rest_zipper,
        carrier: formData.carrier,
        zone: formData.zone
      })
      setResult(data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to calculate pricing')
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Pricing Calculator</Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Configuration</Typography>

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Model</InputLabel>
                  <Select
                    value={formData.model_id || ''}
                    label="Model"
                    onChange={(e) => setFormData({ ...formData, model_id: e.target.value as number })}
                  >
                    {models.map((model) => (
                      <MenuItem key={model.id} value={model.id}>
                        {getModelDisplay(model)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Material</InputLabel>
                  <Select
                    value={formData.material_id || ''}
                    label="Material"
                    onChange={(e) => setFormData({ ...formData, material_id: e.target.value as number })}
                  >
                    {materials.map((material) => (
                      <MenuItem key={material.id} value={material.id}>
                        {material.name} ({material.base_color}) - ${material.cost_per_linear_yard}/yard
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Colour"
                  value={formData.colour}
                  onChange={(e) => setFormData({ ...formData, colour: e.target.value })}
                  helperText="Optional color override"
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Quantity"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  inputProps={{ min: 1 }}
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>Options</Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.handle_zipper}
                      onChange={(e) => setFormData({ ...formData, handle_zipper: e.target.checked })}
                    />
                  }
                  label="Handle Zipper (+$8.00)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.two_in_one_pocket}
                      onChange={(e) => setFormData({ ...formData, two_in_one_pocket: e.target.checked })}
                    />
                  }
                  label="Two-in-One Pocket (+$12.00)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.music_rest_zipper}
                      onChange={(e) => setFormData({ ...formData, music_rest_zipper: e.target.checked })}
                    />
                  }
                  label="Music Rest Zipper (+$10.00)"
                />
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Carrier</InputLabel>
                  <Select
                    value={formData.carrier}
                    label="Carrier"
                    onChange={(e) => setFormData({ ...formData, carrier: e.target.value })}
                  >
                    {carriers.map((c) => (
                      <MenuItem key={c.value} value={c.value}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Zone</InputLabel>
                  <Select
                    value={formData.zone}
                    label="Zone"
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  >
                    {['1', '2', '3', '4', '5'].map((z) => (
                      <MenuItem key={z} value={z}>Zone {z}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={<CalculateIcon />}
                  onClick={handleCalculate}
                >
                  Calculate Price
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Cost Breakdown</Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {result ? (
              <Box>
                <Grid container spacing={1}>
                  <Grid item xs={8}><Typography>Surface Area:</Typography></Grid>
                  <Grid item xs={4}><Typography align="right">{result.area} sq in</Typography></Grid>

                  <Grid item xs={8}><Typography>Area with Waste (5%):</Typography></Grid>
                  <Grid item xs={4}><Typography align="right">{result.waste_area} sq in</Typography></Grid>

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={8}><Typography>Material Cost:</Typography></Grid>
                  <Grid item xs={4}><Typography align="right">${result.material_cost.toFixed(2)}</Typography></Grid>

                  <Grid item xs={8}><Typography>Colour Surcharge:</Typography></Grid>
                  <Grid item xs={4}><Typography align="right">${result.colour_surcharge.toFixed(2)}</Typography></Grid>

                  <Grid item xs={8}><Typography>Option Surcharge:</Typography></Grid>
                  <Grid item xs={4}><Typography align="right">${result.option_surcharge.toFixed(2)}</Typography></Grid>

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={8}><Typography fontWeight="bold">Unit Total:</Typography></Grid>
                  <Grid item xs={4}><Typography align="right" fontWeight="bold">${result.unit_total.toFixed(2)}</Typography></Grid>

                  <Grid item xs={8}><Typography>Quantity:</Typography></Grid>
                  <Grid item xs={4}><Typography align="right">x {formData.quantity}</Typography></Grid>

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={8}><Typography>Estimated Weight:</Typography></Grid>
                  <Grid item xs={4}><Typography align="right">{result.weight.toFixed(2)} oz</Typography></Grid>

                  <Grid item xs={8}><Typography>Shipping Cost:</Typography></Grid>
                  <Grid item xs={4}><Typography align="right">${result.shipping_cost.toFixed(2)}</Typography></Grid>

                  <Grid item xs={12}><Divider sx={{ my: 1 }} /></Grid>

                  <Grid item xs={8}>
                    <Typography variant="h5" color="primary">Grand Total:</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="h5" color="primary" align="right">
                      ${result.total.toFixed(2)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            ) : (
              <Typography color="text.secondary">
                Select a model and material, then click Calculate to see the pricing breakdown.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
