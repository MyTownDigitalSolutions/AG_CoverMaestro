import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select,
  MenuItem, Grid, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Tab, CircularProgress, Chip, Stack,
  Snackbar, Alert, Tooltip, ToggleButton, ToggleButtonGroup
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { modelsApi, seriesApi, equipmentTypesApi, enumsApi, manufacturersApi, settingsApi } from '../services/api'
import type { Model, Series, EquipmentType, EnumValue, Manufacturer, ModelPricingSnapshot, ModelPricingHistory, PricingDiffResponse } from '../types'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import RemoveIcon from '@mui/icons-material/Remove'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import PricingAdminPanel from '../components/PricingAdminPanel'


interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

// Helper to format cents to dollars
const formatMoney = (cents: number) => {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// Helper to fetch details for tooltip
function ShippingTooltip({ children, snapshot }: { children: React.ReactElement, snapshot: ModelPricingSnapshot }) {
  if (!snapshot || snapshot.shipping_cost_cents == null) {
    return (
      <Tooltip title="Details not yet available — recalculate pricing to populate." enterDelay={200}>
        {children}
      </Tooltip>
    )
  }

  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<{
    mode: string,
    cardName?: string,
    zone?: string,
    tierMax?: number,
    weightUsed?: number
  } | null>(null)

  const handleOpen = async () => {
    if (details) return // already loaded
    setLoading(true)
    try {
      const defaults = await settingsApi.getShippingDefaults()
      const d: any = { mode: defaults.shipping_mode, weightUsed: snapshot.weight_oz }

      if (defaults.shipping_mode === 'fixed_cell') {
        if (defaults.assumed_rate_card_id) {
          const cards = await settingsApi.listRateCards(true)
          const c = cards.find(r => r.id === defaults.assumed_rate_card_id)
          if (c) d.cardName = c.name
        }
        if (defaults.assumed_rate_card_id && defaults.assumed_tier_id) {
          const tiers = await settingsApi.listTiers(defaults.assumed_rate_card_id, true)
          const t = tiers.find(x => x.id === defaults.assumed_tier_id)
          if (t) d.tierMax = t.max_oz
        }
        d.zone = defaults.assumed_zone_code
      }
      setDetails(d)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const tooltipContent = loading ? (
    "Loading shipping details..."
  ) : !details ? (
    "Hover to load details"
  ) : (
    <Box sx={{ p: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'capitalize' }}>
        Mode: {details.mode.replace('_', ' ')}
      </Typography>
      {details.mode === 'fixed_cell' && (
        <>
          <Typography variant="body2">Card: {details.cardName || 'Unknown'}</Typography>
          <Typography variant="body2">Zone: {details.zone || '?'}</Typography>
          <Typography variant="body2">Tier: ≤ {details.tierMax} oz</Typography>
        </>
      )}
      {details.mode === 'flat' && <Typography variant="body2">Global Flat Rate Override</Typography>}
      {details.mode === 'calculated' && <Typography variant="body2">Standard Weight-based Calculation</Typography>}
      <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'grey.400' }}>
        Weight Used: {details.weightUsed?.toFixed(2)} oz
      </Typography>
    </Box>
  )

  return (
    <Tooltip title={tooltipContent} onOpen={handleOpen} enterDelay={200}>
      {children}
    </Tooltip>
  )
}

function MaterialTooltip({ children, snapshot, model }: { children: React.ReactElement, snapshot: ModelPricingSnapshot, model: Model }) {
  const area = model.surface_area_sq_in || 0
  const totalCents = snapshot.material_cost_cents

  let content: React.ReactNode = "Details not yet available — recalculate pricing to populate."

  if (area > 0 && totalCents > 0) {
    const centsPerSqIn = totalCents / area // Derived for display if backend meta missing
    // Use metadata if available, else derived
    const rateDisplay = snapshot.material_cost_per_sq_in_cents
      ? `$${(snapshot.material_cost_per_sq_in_cents / 100).toFixed(4)}`
      : `$${(centsPerSqIn / 100).toFixed(4)}`

    // Use metadata area if available? Snapshot has it too now.
    const areaDisplay = snapshot.surface_area_sq_in || area

    content = (
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Material Cost Breakdown</Typography>
        <Typography variant="body2">Surface Area: {areaDisplay.toFixed(2)} sq in</Typography>
        <Typography variant="body2">Cost Rate: {rateDisplay} / sq in</Typography>
        <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'grey.400' }}>
          Total: {formatMoney(totalCents)}
        </Typography>
      </Box>
    )
  }

  return (
    <Tooltip title={content} enterDelay={200}>
      {children}
    </Tooltip>
  )
}

function LaborTooltip({ children, snapshot }: { children: React.ReactElement, snapshot?: ModelPricingSnapshot }) {
  if (!snapshot || snapshot.labor_minutes == null || snapshot.labor_rate_cents_per_hour == null) {
    return (
      <Tooltip title="Labor details not yet available — recalculate pricing to populate." enterDelay={200}>
        {children}
      </Tooltip>
    )
  }

  const minutes = snapshot.labor_minutes
  const rateDollars = snapshot.labor_rate_cents_per_hour / 100
  const totalCents = snapshot.labor_cost_cents

  const content = (
    <Box sx={{ p: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Labor Cost Breakdown</Typography>
      <Typography variant="body2">Time: {minutes} mins</Typography>
      <Typography variant="body2">Rate: ${rateDollars.toFixed(2)} / hr</Typography>
      <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'grey.400' }}>
        Total: {formatMoney(totalCents)}
      </Typography>
    </Box>
  )

  return (
    <Tooltip title={content} enterDelay={200}>
      {children}
    </Tooltip>
  )
}

function MarketplaceFeeTooltip({ children, snapshot }: { children: React.ReactElement, snapshot?: ModelPricingSnapshot }) {
  if (!snapshot || snapshot.retail_price_cents == null || snapshot.marketplace_fee_cents == null) {
    return (
      <Tooltip title="Details not yet available — recalculate pricing to populate." enterDelay={200}>
        {children}
      </Tooltip>
    )
  }

  const retailCents = snapshot.retail_price_cents
  const feeCents = snapshot.marketplace_fee_cents
  const rate = snapshot.marketplace_fee_rate

  let rateDisplay = "unavailable"
  if (rate != null) {
    if (rate > 1) {
      // It's likely already a percentage integer (e.g. 15 for 15%)
      rateDisplay = `${rate.toFixed(1)}%`
    } else {
      // It's a decimal (e.g. 0.15)
      rateDisplay = `${(rate * 100).toFixed(1)}%`
    }
  }

  const content = (
    <Box sx={{ p: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Marketplace Fee</Typography>
      <Typography variant="body2">Rate: {rateDisplay}</Typography>
      <Typography variant="body2">Retail Basis: {formatMoney(retailCents)}</Typography>
      <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'grey.400' }}>
        Total: {formatMoney(feeCents)}
      </Typography>
    </Box>
  )

  return (
    <Tooltip title={content} enterDelay={200}>
      {children}
    </Tooltip>
  )
}

function PricingDialog({ model, open, onClose }: { model: Model | null, open: boolean, onClose: () => void }) {
  const navigate = useNavigate()
  const [tabIndex, setTabIndex] = useState(0)
  const [currentSnapshot, setCurrentSnapshot] = useState<ModelPricingSnapshot | null>(null)
  const [history, setHistory] = useState<ModelPricingHistory[]>([])
  const [diff, setDiff] = useState<PricingDiffResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Notification state
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success')

  // Only relevant for history/diff
  const [selectedMarketplace, setSelectedMarketplace] = useState("amazon")
  const marketplace = selectedMarketplace
  const [selectedVariantKey, setSelectedVariantKey] = useState('choice_no_padding')

  // Setup needed state
  const [setupErrorMessage, setSetupErrorMessage] = useState<string | null>(null)
  const [setupMissingItems, setSetupMissingItems] = useState<string[]>([])

  const BASELINE_VARIANTS: Record<string, string> = {
    'choice_no_padding': 'Choice — No Padding',
    'choice_padded': 'Choice — Padded',
    'premium_no_padding': 'Premium — No Padding',
    'premium_padded': 'Premium — Padded'
  }

  const [baselineSnapshots, setBaselineSnapshots] = useState<ModelPricingSnapshot[]>([])

  useEffect(() => {
    if (open && model) {
      setSetupErrorMessage(null)
      setSetupMissingItems([])
      loadData()
    }
  }, [open, model, tabIndex, marketplace])

  // Effect to update currentSnapshot based on selection if baselines loaded
  useEffect(() => {
    if (baselineSnapshots.length > 0) {
      const found = baselineSnapshots.find(s => s.marketplace === marketplace && s.variant_key === selectedVariantKey)
      setCurrentSnapshot(found || baselineSnapshots[0])
    }
  }, [selectedVariantKey, baselineSnapshots])

  // PHASE PRICING FIX – CHUNK 2A (Fix debug math ONLY)
  useEffect(() => {
    if (currentSnapshot && import.meta.env.DEV) {
      const material_cents = currentSnapshot.material_cost_cents
      const labor_cents = currentSnapshot.labor_cost_cents
      const shipping_cents = currentSnapshot.shipping_cost_cents
      const fee_cents = currentSnapshot.marketplace_fee_cents

      const sum_of_components_cents = material_cents + labor_cents + shipping_cents + fee_cents

      // Invariant: base_cost should effectively be sum of components (excluding fee perhaps, or including? 
      // The prompt asks to check delta. Usually base_cost in this system might be pre-fee or post-fee. 
      // We will log the raw values to find out.)

      const base_cost_cents = currentSnapshot.base_cost_cents
      const retail_cents = currentSnapshot.retail_price_cents
      const profit_cents = currentSnapshot.profit_cents

      const derived_base_from_retail_cents = retail_cents - profit_cents
      const delta_components_vs_base_cents = base_cost_cents - sum_of_components_cents

      console.log("Pricing Debug (Invariant Check):", {
        components_cents: {
          material: material_cents,
          labor: labor_cents,
          shipping: shipping_cents,
          fee: fee_cents
        },
        aggregates_cents: {
          sum_of_components: sum_of_components_cents,
          base_cost_stored: base_cost_cents,
          retail_price: retail_cents,
          profit: profit_cents,
        },
        invariants: {
          derived_base_from_retail: derived_base_from_retail_cents,
          delta_components_vs_base: delta_components_vs_base_cents,
          // Dollar versions for readability
          sum_dollars: (sum_of_components_cents / 100).toFixed(2),
          base_dollars: (base_cost_cents / 100).toFixed(2),
          retail_dollars: (retail_cents / 100).toFixed(2),
        }
      })
    }
  }, [currentSnapshot])

  const loadData = async () => {
    if (!model) return
    setLoading(true)
    setError(null)
    setBaselineSnapshots([])
    // Reset current snapshot on separate marketplace load unless we find something
    setCurrentSnapshot(null)

    try {
      if (tabIndex === 0) {
        // Tab 0: Current Snapshots (All baselines)

        // 1. Safe Mode Fetch (Amazon Only)
        // Keep existing debug fetch as primary safety net BUT ONLY for Amazon
        let fallbackSnap: ModelPricingSnapshot | null = null
        if (marketplace === "amazon") {
          try {
            fallbackSnap = await modelsApi.getDebugPrice(model.id)
            setCurrentSnapshot(fallbackSnap)
          } catch (e) {
            console.warn("Debug pricing fetch failed", e)
          }
        }

        // 2. Additive Fetch (Get all variants for selected marketplace)
        try {
          const snaps = await modelsApi.getBaselineSnapshots(model.id, marketplace)
          if (snaps && snaps.length > 0) {
            setBaselineSnapshots(snaps)
            // Effect will auto-select the current snapshot matching variant
          } else if (marketplace !== "amazon") {
            // Non-amazon, no snapshots -> clear currentSnapshot so we see empty state
            setCurrentSnapshot(null)
          }
        } catch (e) {
          console.warn("Baseline snapshots fetch failed", e)
        }

      } else if (tabIndex === 1) {
        const data = await modelsApi.getPricingHistory(model.id, marketplace, selectedVariantKey)
        setHistory(data)
      } else if (tabIndex === 2) {
        const data = await modelsApi.getPricingDiff(model.id, marketplace, selectedVariantKey)
        setDiff(data)
      }
    } catch (e: any) {
      console.error(e)
      if (!currentSnapshot && marketplace === "amazon") {
        // Only set heavy error for Amazon safety
        setError(e.response?.data?.detail || "Failed to load data")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculate = async () => {
    if (!model) return;
    setLoading(true);
    try {
      await modelsApi.recalculatePricing(model.id, marketplace);
      await loadData(); // Refresh data
      setSnackbarMessage("Baseline pricing recalculated");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
    } catch (e: any) {
      console.error(e);
      const msg = e.response?.data?.detail || "Recalculation failed";

      if (e.response?.status === 400) {
        setSetupErrorMessage(msg);
        const missing: string[] = [];
        const lower = msg.toLowerCase();
        if (lower.includes('shipping profile')) missing.push('Shipping Profile');
        if (lower.includes('rate card')) missing.push('Rate Card');
        if (lower.includes('zone cost') || lower.includes('pricing zone')) missing.push('Pricing Zone / Zone Costs');
        if (lower.includes('fee') || lower.includes('marketplace fee')) missing.push('Marketplace Fee Rate');
        if (lower.includes('profit')) missing.push('Profit Settings');

        if (missing.length === 0) missing.push('Marketplace Configuration');
        setSetupMissingItems(missing);
      }

      // Don't set main error state, use snackbar for action feedback
      // setError(msg); 
      setSnackbarMessage(msg);
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      setLoading(false); // Ensure loading is off if loadData wasn't called
    }
  };

  if (!model) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Pricing: {model.name}</span>
        <Button
          variant="contained"
          onClick={handleRecalculate}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
        >
          {loading ? 'Calculating...' : `Recalculate Baseline (${marketplace.charAt(0).toUpperCase() + marketplace.slice(1)})`}
        </Button>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} aria-label="pricing tabs">
            <Tab label={`Current (${marketplace.charAt(0).toUpperCase() + marketplace.slice(1)} Baseline)`} />
            <Tab label="History" />
            <Tab label="Diff (Latest)" />
          </Tabs>
        </Box>

        {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}

        {error && !loading && (
          <Box sx={{ p: 2, color: 'error.main' }}>
            <Typography>{error}</Typography>
            {/* Fallback help text */}
            <Typography variant="caption" color="text.secondary">
              (Tip: If "Baseline snapshot missing", click Recalculate above or run <code>python scripts/seed_pricing_history_demo.py</code>)
            </Typography>
          </Box>
        )}

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={6000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbarOpen(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
            {snackbarMessage}
          </Alert>
        </Snackbar>

        {!loading && !error && (
          <>
            {/* CURRENT TAB */}
            <CustomTabPanel value={tabIndex} index={0}>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                <ToggleButtonGroup
                  value={selectedMarketplace}
                  exclusive
                  onChange={(_, val) => val && setSelectedMarketplace(val)}
                  size="small"
                  aria-label="marketplace"
                >
                  <ToggleButton value="amazon" aria-label="amazon">
                    Amazon
                  </ToggleButton>
                  <ToggleButton value="ebay" aria-label="ebay">
                    eBay
                  </ToggleButton>
                  <ToggleButton value="reverb" aria-label="reverb">
                    Reverb
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Setup Needed Panel */}
              {(setupErrorMessage || (baselineSnapshots.length === 0 && marketplace !== 'amazon')) && (
                <Paper sx={{ p: 2, mb: 3, bgcolor: '#fff4e5', border: '1px solid #ffcc80' }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <WarningAmberIcon color="warning" />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        Setup needed for {marketplace.charAt(0).toUpperCase() + marketplace.slice(1)}
                      </Typography>

                      {setupErrorMessage ? (
                        <>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            {setupErrorMessage}
                          </Typography>
                          {setupMissingItems.length > 0 && (
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Missing:</Typography>
                              <ul style={{ margin: '4px 0', paddingLeft: '20px', fontSize: '0.875rem' }}>
                                {setupMissingItems.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </Box>
                          )}
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          No pricing snapshots found for this marketplace yet.
                        </Typography>
                      )}

                      <Box sx={{ mt: 1 }}>
                        {setupErrorMessage && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            onClick={handleRecalculate}
                            disabled={loading}
                            sx={{ mr: 1, borderColor: 'rgba(0,0,0,0.23)', color: 'text.primary' }}
                          >
                            Recalculate again
                          </Button>
                        )}
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => navigate('/settings/shipping-rates')}
                        >
                          Go to Shipping Settings
                        </Button>
                      </Box>
                    </Box>
                  </Stack>
                </Paper>
              )}

              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Variant</InputLabel>
                  <Select
                    value={selectedVariantKey}
                    label="Variant"
                    onChange={(e) => setSelectedVariantKey(e.target.value)}
                  >
                    {Object.entries(BASELINE_VARIANTS).map(([key, label]) => (
                      <MenuItem key={key} value={key}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {(!currentSnapshot || currentSnapshot.variant_key !== selectedVariantKey) && !loading && (
                  <Typography variant="body2" color="error">
                    {marketplace !== 'amazon' && baselineSnapshots.length === 0
                      ? "No snapshots for this marketplace yet — recalculate pricing for this marketplace to populate."
                      : "Variant snapshot not available — recalculate baseline."}
                  </Typography>
                )}
              </Box>

              {currentSnapshot ? (
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Typography variant="h3" color="primary" align="center" sx={{ mb: 1 }}>
                      {formatMoney(currentSnapshot.retail_price_cents)}
                    </Typography>
                    <Typography variant="subtitle1" align="center" color="text.secondary">
                      Retail Price (Amazon / {BASELINE_VARIANTS[selectedVariantKey]})
                    </Typography>
                    <Typography variant="caption" display="block" align="center" sx={{ mb: 1 }}>
                      Calculated: {new Date(currentSnapshot.calculated_at).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" display="block" align="center" color="text.secondary" sx={{ mb: 3 }}>
                      (Baseline recalculation updates all 4 baseline variants: Choice/Premium × Padded/No Padding)
                    </Typography>
                  </Grid>

                  {/* Big Cards: Total Cost | Profit | Margin */}
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6">
                        {formatMoney(currentSnapshot.base_cost_cents)}
                      </Typography>
                      <Typography variant="caption">Total Cost</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6" color="success.main">
                        {formatMoney(currentSnapshot.profit_cents)}
                      </Typography>
                      <Typography variant="caption">Profit</Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={4}>
                    <Paper sx={{ p: 2, textAlign: 'center' }}>
                      <Typography variant="h6" color="primary">
                        {currentSnapshot.retail_price_cents > 0
                          ? `${((currentSnapshot.profit_cents / currentSnapshot.retail_price_cents) * 100).toFixed(1)}%`
                          : '0.0%'}
                      </Typography>
                      <Typography variant="caption">Profit Margin</Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom><b>Cost Breakdown:</b></Typography>
                      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                        <MaterialTooltip snapshot={currentSnapshot} model={model}>
                          <Chip label={`Material: ${formatMoney(currentSnapshot.material_cost_cents)}`} variant="outlined" />
                        </MaterialTooltip>
                        <LaborTooltip snapshot={currentSnapshot}>
                          <Chip label={`Labor: ${formatMoney(currentSnapshot.labor_cost_cents)}`} variant="outlined" />
                        </LaborTooltip>

                        <ShippingTooltip snapshot={currentSnapshot}>
                          <Chip label={`Shipping: ${formatMoney(currentSnapshot.shipping_cost_cents)}`} variant="outlined" icon={<LocalShippingIcon />} />
                        </ShippingTooltip>

                        <MarketplaceFeeTooltip snapshot={currentSnapshot}>
                          <Chip label={`Marketplace Fee: ${formatMoney(currentSnapshot.marketplace_fee_cents)}`} variant="outlined" />
                        </MarketplaceFeeTooltip>
                        <Chip label={`Weight: ${currentSnapshot.weight_oz.toFixed(1)} oz`} variant="outlined" />
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              ) : <Typography>No data.</Typography>}
            </CustomTabPanel>

            {/* HISTORY TAB */}
            <CustomTabPanel value={tabIndex} index={1}>
              <TableContainer component={Paper} elevation={0} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Retail Price</TableCell>
                      <TableCell align="right">Base Cost</TableCell>
                      <TableCell align="right">Profit</TableCell>
                      <TableCell align="right">Fee</TableCell>
                      <TableCell align="right">Weight</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.calculated_at).toLocaleString()}</TableCell>
                        <TableCell align="right"><b>{formatMoney(row.retail_price_cents)}</b></TableCell>
                        <TableCell align="right">{formatMoney(row.base_cost_cents)}</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}>{formatMoney(row.profit_cents)}</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main' }}>{formatMoney(row.marketplace_fee_cents)}</TableCell>
                        <TableCell align="right">{row.weight_oz.toFixed(1)} oz</TableCell>
                        <TableCell sx={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'text.secondary' }}>{row.reason}</TableCell>
                      </TableRow>
                    ))}
                    {history.length === 0 && <TableRow><TableCell colSpan={7} align="center">No history found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </TableContainer>
            </CustomTabPanel>

            {/* DIFF TAB */}
            <CustomTabPanel value={tabIndex} index={2}>
              {diff && diff.diffs.length > 0 ? (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Comparing {new Date(diff.old_version_date).toLocaleString()} vs {new Date(diff.new_version_date).toLocaleString()}
                  </Typography>
                  <TableContainer component={Paper} elevation={0} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Field</TableCell>
                          <TableCell align="right">Old Value</TableCell>
                          <TableCell align="right">New Value</TableCell>
                          <TableCell align="right">Delta</TableCell>
                          <TableCell align="center">Change</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {diff.diffs.map((d, i) => (
                          <TableRow key={i}>
                            <TableCell sx={{ textTransform: 'capitalize' }}>{d.field_name.replace(/_/g, ' ')}</TableCell>
                            <TableCell align="right">{d.old_value}</TableCell>
                            <TableCell align="right">{d.new_value}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{d.delta}</TableCell>
                            <TableCell align="center">
                              {d.direction === 'increase' && <Chip icon={<ArrowUpwardIcon />} label="Increase" color="error" size="small" variant="outlined" />}
                              {d.direction === 'decrease' && <Chip icon={<ArrowDownwardIcon />} label="Decrease" color="success" size="small" variant="outlined" />}
                              {d.direction === 'change' && <Chip icon={<RemoveIcon />} label="Change" size="small" variant="outlined" />}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              ) : (
                <Typography>No significant differences found between the last two versions.</Typography>
              )}
            </CustomTabPanel>
          </>
        )}

      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [handleLocations, setHandleLocations] = useState<EnumValue[]>([])
  const [angleTypes, setAngleTypes] = useState<EnumValue[]>([])
  const [filterSeries, setFilterSeries] = useState<number | ''>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)

  // Delete confirmation state
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [modelToDelete, setModelToDelete] = useState<number | null>(null)

  // Pricing Dialog
  const [pricingModel, setPricingModel] = useState<Model | null>(null)

  // Pricing Admin
  const [pricingAdminOpen, setPricingAdminOpen] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    series_id: 0,
    equipment_type_id: 0,
    width: 0,
    depth: 0,
    height: 0,
    handle_length: 0,
    handle_width: 0,
    handle_location: 'none',
    angle_type: 'none',
    image_url: ''
  })

  const loadData = async () => {
    const [modelsData, seriesData, manufacturersData, equipmentTypesData, handleLocData, angleTypesData] = await Promise.all([
      modelsApi.list(filterSeries || undefined),
      seriesApi.list(),
      manufacturersApi.list(),
      equipmentTypesApi.list(),
      enumsApi.handleLocations(),
      enumsApi.angleTypes()
    ])
    setModels(modelsData)
    setSeries(seriesData)
    setManufacturers(manufacturersData)
    setEquipmentTypes(equipmentTypesData)
    setHandleLocations(handleLocData)
    setAngleTypes(angleTypesData)
  }

  useEffect(() => {
    loadData()
  }, [filterSeries])

  const getSeriesWithManufacturer = (seriesId: number) => {
    const s = series.find(x => x.id === seriesId)
    if (!s) return 'Unknown'
    const m = manufacturers.find(x => x.id === s.manufacturer_id)
    return m ? `${m.name} - ${s.name}` : s.name
  }

  const handleSave = async () => {
    const data = {
      ...formData,
      handle_length: formData.handle_length || undefined,
      handle_width: formData.handle_width || undefined,
      image_url: formData.image_url || undefined
    }

    if (editingModel) {
      await modelsApi.update(editingModel.id, data)
    } else {
      await modelsApi.create(data)
    }
    setDialogOpen(false)
    resetForm()
    loadData()
  }

  const handleDeleteClick = (id: number) => {
    setModelToDelete(id)
    setDeleteConfirmationOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (modelToDelete !== null) {
      await modelsApi.delete(modelToDelete)
      loadData()
      setDeleteConfirmationOpen(false)
      setModelToDelete(null)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      series_id: 0,
      equipment_type_id: 0,
      width: 0,
      depth: 0,
      height: 0,
      handle_length: 0,
      handle_width: 0,
      handle_location: 'none',
      angle_type: 'none',
      image_url: ''
    })
    setEditingModel(null)
  }

  const openEdit = (model: Model) => {
    setEditingModel(model)
    setFormData({
      name: model.name,
      series_id: model.series_id,
      equipment_type_id: model.equipment_type_id,
      width: model.width,
      depth: model.depth,
      height: model.height,
      handle_length: model.handle_length || 0,
      handle_width: model.handle_width || 0,
      handle_location: model.handle_location,
      angle_type: model.angle_type,
      image_url: model.image_url || ''
    })
    setDialogOpen(true)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Models</Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<MonetizationOnIcon />}
            onClick={() => setPricingAdminOpen(true)}
          >
            Pricing Admin
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              resetForm()
              setDialogOpen(true)
            }}
          >
            Add Model
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Series</InputLabel>
          <Select
            value={filterSeries}
            label="Filter by Series"
            onChange={(e) => setFilterSeries(e.target.value as number | '')}
          >
            <MenuItem value="">All Series</MenuItem>
            {series.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {getSeriesWithManufacturer(s.id)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Parent SKU</TableCell>
              <TableCell>Series</TableCell>
              <TableCell>Dimensions (W x D x H)</TableCell>
              <TableCell>Area (sq in)</TableCell>
              <TableCell>Handle</TableCell>
              <TableCell>Angle</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {models.map((model) => (
              <TableRow key={model.id}>
                <TableCell>{model.name}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{model.parent_sku || '-'}</TableCell>
                <TableCell>{getSeriesWithManufacturer(model.series_id)}</TableCell>
                <TableCell>{`${model.width}" x ${model.depth}" x ${model.height}"`}</TableCell>
                <TableCell>{model.surface_area_sq_in?.toFixed(2) || '-'}</TableCell>
                <TableCell>{model.handle_location}</TableCell>
                <TableCell>{model.angle_type}</TableCell>
                <TableCell>
                  <IconButton onClick={() => setPricingModel(model)} title="Pricing"><MonetizationOnIcon /></IconButton>
                  <IconButton onClick={() => openEdit(model)}><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDeleteClick(model.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            resize: 'both',
            overflow: 'auto',
            minWidth: 400,
            minHeight: 300
          }
        }}
      >
        <DialogTitle>{editingModel ? 'Edit Model' : 'Add Model'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Series</InputLabel>
                <Select
                  value={formData.series_id || ''}
                  label="Series"
                  onChange={(e) => setFormData({ ...formData, series_id: e.target.value as number })}
                >
                  {series.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {getSeriesWithManufacturer(s.id)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {formData.series_id > 0 && (
                <Box sx={{ mt: 1, pl: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Existing models in this series:
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                    {models
                      .filter(m => m.series_id === formData.series_id && m.id !== editingModel?.id)
                      .map(m => m.name)
                      .join(', ') || 'None yet'}
                  </Typography>
                </Box>
              )}
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Model Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Equipment Type</InputLabel>
                <Select
                  value={formData.equipment_type_id || ''}
                  label="Equipment Type"
                  onChange={(e) => setFormData({ ...formData, equipment_type_id: e.target.value as number })}
                >
                  {equipmentTypes.map((et) => (
                    <MenuItem key={et.id} value={et.id}>{et.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} />
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Width (inches)"
                value={formData.width}
                onChange={(e) => setFormData({ ...formData, width: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Depth (inches)"
                value={formData.depth}
                onChange={(e) => setFormData({ ...formData, depth: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label="Height (inches)"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) })}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Handle Location</InputLabel>
                <Select
                  value={formData.handle_location}
                  label="Handle Location"
                  onChange={(e) => setFormData({ ...formData, handle_location: e.target.value })}
                >
                  {handleLocations.map((hl) => (
                    <MenuItem key={hl.value} value={hl.value}>{hl.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Angle Type</InputLabel>
                <Select
                  value={formData.angle_type}
                  label="Angle Type"
                  onChange={(e) => setFormData({ ...formData, angle_type: e.target.value })}
                >
                  {angleTypes.map((at) => (
                    <MenuItem key={at.value} value={at.value}>{at.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Image URL"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmationOpen}
        onClose={() => setDeleteConfirmationOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this model? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmationOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <PricingDialog
        open={!!pricingModel}
        model={pricingModel}
        onClose={() => setPricingModel(null)}
      />

      <PricingAdminPanel
        open={pricingAdminOpen}
        onClose={() => setPricingAdminOpen(false)}
        manufacturers={manufacturers}
        series={series}
        models={models}
      />
    </Box>
  )
}
