import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, FormControl, InputLabel, Select, MenuItem,
  Grid, TextField, FormControlLabel, Checkbox, Button, Divider, Alert,
  Chip, Tooltip, Stack
} from '@mui/material'
import CalculateIcon from '@mui/icons-material/Calculate'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { modelsApi, materialsApi, pricingApi, enumsApi, seriesApi, manufacturersApi, settingsApi } from '../services/api'
import type { Model, Material, PricingResult, EnumValue, Series, Manufacturer, ShippingZone, ShippingDefaultSettingResponse } from '../types'

export default function PricingCalculator() {
  const [models, setModels] = useState<Model[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [carriers, setCarriers] = useState<EnumValue[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [zones, setZones] = useState<ShippingZone[]>([])
  const [result, setResult] = useState<PricingResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [shippingDefaults, setShippingDefaults] = useState<ShippingDefaultSettingResponse | null>(null)
  const [fixedRate, setFixedRate] = useState<number | null>(null)

  // New state for Fixed Cell details
  const [fixedCellDetails, setFixedCellDetails] = useState<{
    cardName: string;
    tierMaxOz: number;
    zoneCode: string;
  } | null>(null)

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
      try {
        const [modelsData, materialsData, carriersData, seriesData, manufacturersData, zonesData, defaultsData] = await Promise.all([
          modelsApi.list(),
          materialsApi.list(),
          enumsApi.carriers(),
          seriesApi.list(),
          manufacturersApi.list(),
          settingsApi.listZones(),
          settingsApi.getShippingDefaults()
        ])
        setModels(modelsData)
        setMaterials(materialsData)
        setCarriers(carriersData)
        setSeries(seriesData)
        setManufacturers(manufacturersData)
        setZones(zonesData)
        setShippingDefaults(defaultsData)

        // Resolve Fixed Cell Details if active
        if (defaultsData.shipping_mode === 'fixed_cell') {
          let cardName = "Unknown Card"
          let tierMaxOz = 0

          // 1. Fetch Rate Card Name
          if (defaultsData.assumed_rate_card_id) {
            try {
              const cards = await settingsApi.listRateCards(true) // include inactive
              const card = cards.find(c => c.id === defaultsData.assumed_rate_card_id)
              if (card) cardName = card.name
            } catch (e) { console.error("Error fetching rate card for fixed cell details", e) }
          }

          // 2. Fetch Tier Details
          if (defaultsData.assumed_rate_card_id && defaultsData.assumed_tier_id) {
            try {
              const tiers = await settingsApi.listTiers(defaultsData.assumed_rate_card_id, true)
              const tier = tiers.find(t => t.id === defaultsData.assumed_tier_id)
              if (tier) tierMaxOz = tier.max_oz
            } catch (e) { console.error("Error fetching tiers for fixed cell details", e) }
          }

          // 3. Fetch Rate Amount (Existing logic)
          if (defaultsData.assumed_tier_id && defaultsData.assumed_zone_code) {
            try {
              const rates = await settingsApi.listZoneRates(defaultsData.assumed_tier_id)
              const match = rates.find(r => r.zone_code === defaultsData.assumed_zone_code)
              if (match && match.rate_cents !== null) {
                setFixedRate(match.rate_cents)
              }
            } catch (e) { console.error("Failed to resolve fixed rate", e) }
          }

          setFixedCellDetails({
            cardName,
            tierMaxOz,
            zoneCode: defaultsData.assumed_zone_code || "?"
          })
        }
      } catch (err) {
        console.error("Failed to load initial data", err)
        setError("Failed to load configuration data.")
      }
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

  const formatMoney = (val: number) => `$${val.toFixed(2)}`

  // Render helper for shipping chips
  const renderShippingChips = (cost: number) => {
    if (!shippingDefaults) {
      return (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" flexWrap="wrap">
          <Tooltip title="Shipping settings failed to load">
            <Chip label="Mode Unknown" color="warning" variant="outlined" size="small" />
          </Tooltip>
          <Chip label={formatMoney(cost)} color="default" size="small" />
        </Stack>
      )
    }

    const mode = shippingDefaults.shipping_mode

    return (
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
        {/* Cost Chip (Always present) */}
        <Chip
          label={formatMoney(cost)}
          color="default"
          size="small"
          icon={<LocalShippingIcon />}
        />

        {/* Mode Specific Chips */}

        {/* A) Calculated */}
        {mode === 'calculated' && (
          <>
            <Tooltip title="Shipping Mode: Calculated (weight-based). Uses Marketplace Profile zone if present, otherwise Default Zone if configured.">
              <Chip label="Calculated" color="primary" size="small" />
            </Tooltip>
            <Tooltip title={`Based on estimated weight: ${result?.weight.toFixed(2)} oz`}>
              <Chip label="Weight-based" variant="outlined" size="small" />
            </Tooltip>
            {/* If we had zone info in result, we'd show it here. Assuming formData zone for now as proxy if relevant? 
                        Actually prompt says "If you can determine marketplace profile zone from the pricing result". 
                        The result object doesn't strictly have it, but we can infer or leave it out. 
                        Safe to leave it out to avoid confusion vs formData zone. 
                    */}
          </>
        )}

        {/* B) Flat */}
        {mode === 'flat' && (
          <>
            <Tooltip title="Shipping Mode: Flat Rate (global override). Overrides all weight/zone lookups.">
              <Chip label="Flat" color="secondary" size="small" />
            </Tooltip>
            <Chip
              label={`${formatMoney(shippingDefaults.flat_shipping_cents / 100)} Global`}
              variant="outlined"
              size="small"
            />
          </>
        )}

        {/* C) Fixed Cell */}
        {mode === 'fixed_cell' && (
          <>
            {fixedCellDetails ? (
              <>
                <Tooltip title={`Shipping Mode: Fixed Cell\nRate Card: ${fixedCellDetails.cardName}\nDerived Shipping: ${formatMoney(cost)}`}>
                  <Chip label="Fixed Cell" color="success" size="small" />
                </Tooltip>

                <Tooltip title={`Zone: ${fixedCellDetails.zoneCode}`}>
                  <Chip label={`Zone ${fixedCellDetails.zoneCode}`} variant="outlined" size="small" />
                </Tooltip>

                <Tooltip title={`Tier: Weight Not Over ≤ ${fixedCellDetails.tierMaxOz} oz`}>
                  <Chip label={`≤ ${fixedCellDetails.tierMaxOz} oz`} variant="outlined" size="small" />
                </Tooltip>

                <Tooltip title={`Rate Card: ${fixedCellDetails.cardName}`}>
                  <Chip label={fixedCellDetails.cardName} variant="outlined" size="small" sx={{ maxWidth: 150 }} />
                </Tooltip>
              </>
            ) : (
              <Tooltip title="Fixed Cell settings are incomplete or loading">
                <Chip label="Fixed Cell (Incomplete)" color="warning" variant="outlined" size="small" />
              </Tooltip>
            )}
          </>
        )}
      </Stack>
    )
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
                    {zones.map((z) => (
                      <MenuItem key={z.id} value={z.code}>{z.name}</MenuItem>
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
          {shippingDefaults && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Active Shipping Mode
              </Typography>

              {shippingDefaults.shipping_mode === 'calculated' && (
                <Alert severity="info" variant="outlined" sx={{ mt: 1, bgcolor: 'white' }}>
                  <strong>Calculated</strong> — Based on weight & marketplace profile zone.
                </Alert>
              )}

              {shippingDefaults.shipping_mode === 'flat' && (
                <Alert severity="warning" variant="outlined" sx={{ mt: 1, bgcolor: 'white' }}>
                  <strong>Flat Rate Override</strong> — Global cost: <strong>${(shippingDefaults.flat_shipping_cents / 100).toFixed(2)}</strong>
                </Alert>
              )}

              {shippingDefaults.shipping_mode === 'fixed_cell' && (
                <Alert severity="success" variant="outlined" sx={{ mt: 1, bgcolor: 'white' }}>
                  <strong>Fixed Cell (Assumed)</strong><br />
                  Zone {shippingDefaults.assumed_zone_code} / Tier #{shippingDefaults.assumed_tier_id}<br />
                  {fixedRate !== null
                    ? <span>Resolved Amount: <strong>${(fixedRate / 100).toFixed(2)}</strong></span>
                    : "Amount: Loading/Not Found"
                  }
                </Alert>
              )}
            </Paper>
          )}

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Cost Breakdown</Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {result ? (
              <Box>
                <Grid container spacing={1} alignItems="center">
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

                  <Grid item xs={12} sm={3}><Typography>Shipping Cost:</Typography></Grid>
                  <Grid item xs={12} sm={9}>
                    {renderShippingChips(result.shipping_cost)}
                  </Grid>

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

