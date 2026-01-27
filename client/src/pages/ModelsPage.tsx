import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Paper, Button, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, InputLabel, Select,
  MenuItem, Grid, IconButton, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tabs, Tab, CircularProgress, Chip, Stack,
  Snackbar, Alert, Tooltip, ToggleButton, ToggleButtonGroup, Checkbox,
  FormControlLabel, FormGroup, FormHelperText
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { modelsApi, seriesApi, equipmentTypesApi, enumsApi, manufacturersApi, settingsApi } from '../services/api'
import type { Model, Series, EquipmentType, Manufacturer, ModelPricingSnapshot, ModelPricingHistory, PricingDiffResponse, DesignOption } from '../types'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import RemoveIcon from '@mui/icons-material/Remove'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
import BoltIcon from '@mui/icons-material/Bolt'
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

// Conversion helpers for dimensions
const inchesToMm = (inches: number): number => {
  return Math.round(inches * 25.4) // Round to whole number for display
}

const mmToInches = (mm: number): number => {
  return Math.round((mm / 25.4) * 100) / 100 // Round to 2 decimal places
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
    if (currentSnapshot && (import.meta as any).env.DEV) {
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
                        {marketplace === 'ebay'
                          ? 'No pricing snapshots found'
                          : marketplace === 'reverb'
                            ? 'Pricing Missing for Reverb'
                            : `Setup needed for ${marketplace.charAt(0).toUpperCase() + marketplace.slice(1)}`}
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
                          {marketplace === 'ebay'
                            ? "No pricing snapshots found. Please click 'Recalculate Baseline' to generate pricing for eBay."
                            : marketplace === 'reverb'
                              ? "No pricing snapshots found. Please click 'Recalculate Baseline' to generate pricing for Reverb."
                              : "No pricing snapshots found for this marketplace yet."}
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
                        {marketplace !== 'reverb' && marketplace !== 'ebay' && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() => navigate('/settings/shipping-rates')}
                          >
                            Go to Shipping Settings
                          </Button>
                        )}
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
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [models, setModels] = useState<Model[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [filterSeries, setFilterSeries] = useState<number | ''>('')
  const [filterManufacturer, setFilterManufacturer] = useState<number | ''>('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)

  // Delete confirmation state
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const [modelToDelete, setModelToDelete] = useState<number | null>(null)

  // Pricing Dialog
  const [pricingModel, setPricingModel] = useState<Model | null>(null)

  // Pricing Admin
  const [pricingAdminOpen, setPricingAdminOpen] = useState(false)
  const modelNameInputRef = useRef<HTMLInputElement | null>(null)

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
    angle_type: 'No Angle',
    image_url: '',
    parent_sku: '',
    sku_override: '',
    handle_location_option_id: null as number | null,
    angle_type_option_id: null as number | null,
    top_handle_length_in: null as number | null,
    top_handle_height_in: null as number | null,
    top_handle_rear_edge_to_center_in: null as number | null,
    model_notes: '',  // PART B: Universal model notes field
    selectedMarketplace: 'amazon',
    marketplace_listings_amazon_external_id: '',
    marketplace_listings_ebay_external_id: '',
    marketplace_listings_reverb_external_id: '',
    marketplace_listings_etsy_external_id: '',
    aplus_brand_story_uploaded: false,
    aplus_brand_story_notes: '',
    aplus_ebc_uploaded: false,
    aplus_ebc_notes: '',
    exclude_from_amazon_export: false,
    exclude_from_ebay_export: false,
    exclude_from_reverb_export: false,
    exclude_from_etsy_export: false,
    dimensionUnit: 'inches' as 'inches' | 'mm'
  })

  const [textOptionValues, setTextOptionValues] = useState<Record<number, string>>({})
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [bulkDimensionUnit, setBulkDimensionUnit] = useState<'inches' | 'mm'>('inches')

  // Bulk Edit State
  const [selectedModelIds, setSelectedModelIds] = useState<Set<number>>(new Set())
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkEditApplying, setBulkEditApplying] = useState(false)
  const [bulkEditState, setBulkEditState] = useState({
    amazonAsin: { enabled: false, mode: 'set' as const, value: '' },
    measurements: { enabled: false, width: '' as number | '', depth: '' as number | '', height: '' as number | '' },
    notes: { enabled: false, mode: 'replace' as const, value: '' },
    exportExclusion: {
      enabled: false,
      exclude_amazon: false,
      exclude_ebay: false,
      exclude_reverb: false,
      exclude_etsy: false
    }
  })

  // Row Edit State
  const [editingRowId, setEditingRowId] = useState<number | null>(null)
  const [editingRowData, setEditingRowData] = useState({ asin: '', notes: '' })
  const [rowSaveError, setRowSaveError] = useState<string | null>(null)

  // Bulk Edit Columns Mode
  const [isBulkEditMode, setIsBulkEditMode] = useState(false)
  const [selectedBulkColumns, setSelectedBulkColumns] = useState<Set<string>>(new Set())
  const [bulkDrafts, setBulkDrafts] = useState<Record<number, any>>({})
  const [savingRowId, setSavingRowId] = useState<number | null>(null)

  // Batch Save State
  const [selectedBulkSaveIds, setSelectedBulkSaveIds] = useState<Set<number>>(new Set())
  const [rowSaveStatusById, setRowSaveStatusById] = useState<Record<number, 'idle' | 'saving' | 'success' | 'error'>>({})
  const [saveAllStatus, setSaveAllStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const handleColumnToggle = (col: string) => {
    const newSet = new Set(selectedBulkColumns)
    if (newSet.has(col)) {
      newSet.delete(col)
    } else {
      if (newSet.size >= 2) return
      newSet.add(col)
    }
    setSelectedBulkColumns(newSet)
    if (newSet.size === 0 && isBulkEditMode) setIsBulkEditMode(false)
  }

  const handleBulkDraftChange = (id: number, field: string, value: any) => {
    setBulkDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }))
    // Clear save status when editing
    setRowSaveStatusById(prev => ({ ...prev, [id]: 'idle' }))
    setSaveAllStatus('idle')
  }

  // Helper to check if a row has unsaved changes
  const isRowDirty = (modelId: number): boolean => {
    return bulkDrafts[modelId] !== undefined && Object.keys(bulkDrafts[modelId]).length > 0
  }

  // Toggle row selection for batch save
  const handleToggleBulkSaveSelection = (id: number) => {
    setSelectedBulkSaveIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  // Select all changed rows
  const handleSelectChanged = () => {
    const changedIds = filteredModels.filter(m => isRowDirty(m.id)).map(m => m.id)
    setSelectedBulkSaveIds(new Set(changedIds))
  }

  // Toggle select all visible rows
  const handleToggleSelectAllVisible = () => {
    const visibleIds = filteredModels.map(m => m.id)
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedBulkSaveIds.has(id))

    if (allVisibleSelected) {
      // Remove all visible from selection
      setSelectedBulkSaveIds(prev => {
        const newSet = new Set(prev)
        visibleIds.forEach(id => newSet.delete(id))
        return newSet
      })
    } else {
      // Add all visible to selection
      setSelectedBulkSaveIds(prev => {
        const newSet = new Set(prev)
        visibleIds.forEach(id => newSet.add(id))
        return newSet
      })
    }
  }

  // Save all selected rows
  const handleSaveAll = async () => {
    const idsToSave = Array.from(selectedBulkSaveIds)
    if (idsToSave.length === 0) return

    setSaveAllStatus('saving')
    let allSuccess = true

    for (const id of idsToSave) {
      setRowSaveStatusById(prev => ({ ...prev, [id]: 'saving' }))
      try {
        await handleRowBulkSave(id)
        setRowSaveStatusById(prev => ({ ...prev, [id]: 'success' }))
      } catch (error) {
        setRowSaveStatusById(prev => ({ ...prev, [id]: 'error' }))
        allSuccess = false
      }
    }

    setSaveAllStatus(allSuccess ? 'success' : 'error')
  }

  const handleRowBulkSave = async (id: number) => {
    setSavingRowId(id)
    setRowSaveStatusById(prev => ({ ...prev, [id]: 'saving' }))
    const draft = bulkDrafts[id] || {}
    const model = models.find(m => m.id === id)
    if (!model) {
      setSavingRowId(null)
      return
    }

    try {
      // Prepare payload
      let listings = model.marketplace_listings ? [...model.marketplace_listings] : []
      let updateData: any = {}

      // Amazon ASIN
      if (selectedBulkColumns.has('amazon_asin')) {
        const val = draft.asin !== undefined ? draft.asin : (model.marketplace_listings?.find(l => l.marketplace === 'amazon')?.external_id || '')
        if (val.trim()) {
          listings = listings.filter(l => l.marketplace !== 'amazon')
          listings.push({ marketplace: 'amazon', external_id: val.trim() } as any)
        } else {
          listings = listings.filter(l => l.marketplace !== 'amazon')
        }
      }

      // eBay ID
      if (selectedBulkColumns.has('ebay_id')) {
        const val = draft.ebay !== undefined ? draft.ebay : (model.marketplace_listings?.find(l => l.marketplace === 'ebay')?.external_id || '')
        if (val.trim()) {
          listings = listings.filter(l => l.marketplace !== 'ebay')
          listings.push({ marketplace: 'ebay', external_id: val.trim() } as any)
        } else {
          listings = listings.filter(l => l.marketplace !== 'ebay')
        }
      }

      // Reverb ID
      if (selectedBulkColumns.has('reverb_id')) {
        const val = draft.reverb !== undefined ? draft.reverb : (model.marketplace_listings?.find(l => l.marketplace === 'reverb')?.external_id || '')
        if (val.trim()) {
          listings = listings.filter(l => l.marketplace !== 'reverb')
          listings.push({ marketplace: 'reverb', external_id: val.trim() } as any)
        } else {
          listings = listings.filter(l => l.marketplace !== 'reverb')
        }
      }

      // Model Notes
      if (selectedBulkColumns.has('model_notes')) {
        const val = draft.notes !== undefined ? draft.notes : (model.model_notes || '')
        updateData.model_notes = val || null
      }

      // Dimensions
      if (selectedBulkColumns.has('dimensions')) {
        // Convert mm to inches if needed before saving
        if (draft.width !== undefined) {
          updateData.width = bulkDimensionUnit === 'mm' ? mmToInches(Number(draft.width)) : Number(draft.width);
        }
        if (draft.depth !== undefined) {
          updateData.depth = bulkDimensionUnit === 'mm' ? mmToInches(Number(draft.depth)) : Number(draft.depth);
        }
        if (draft.height !== undefined) {
          updateData.height = bulkDimensionUnit === 'mm' ? mmToInches(Number(draft.height)) : Number(draft.height);
        }
      }

      // Equipment Type
      if (selectedBulkColumns.has('equipment_type')) {
        if (draft.equipment_type_id) updateData.equipment_type_id = Number(draft.equipment_type_id)
      }

      // Amazon A+ Content
      if (selectedBulkColumns.has('aplus_brand_story') || selectedBulkColumns.has('aplus_ebc')) {
        const currentContent = model.amazon_a_plus_content || []
        const newContent = []

        const getEffective = (type: string, uploadedKey: string, notesKey: string) => {
          const existing = currentContent.find(c => c.content_type === type)
          const draftUploaded = draft[uploadedKey]
          const draftNotes = draft[notesKey]

          return {
            content_type: type,
            is_uploaded: draftUploaded !== undefined ? draftUploaded : (existing?.is_uploaded || false),
            notes: draftNotes !== undefined ? draftNotes : (existing?.notes || null)
          }
        }

        if (selectedBulkColumns.has('aplus_brand_story')) {
          newContent.push(getEffective('BRAND_STORY', 'aplus_brand_story_uploaded', 'aplus_brand_story_notes'))
        } else {
          const exist = currentContent.find(c => c.content_type === 'BRAND_STORY')
          if (exist) newContent.push(exist)
        }

        if (selectedBulkColumns.has('aplus_ebc')) {
          newContent.push(getEffective('EBC', 'aplus_ebc_uploaded', 'aplus_ebc_notes'))
        } else {
          const exist = currentContent.find(c => c.content_type === 'EBC')
          if (exist) newContent.push(exist)
        }

        if (newContent.length > 0) {
          updateData.amazon_a_plus_content = newContent
        }
      }

      // Export Exclusions
      if (selectedBulkColumns.has('export_exclusions')) {
        const getFlag = (key: string, modelKey: keyof Model) => {
          return draft[key] !== undefined ? draft[key] : (model[modelKey] || false)
        }
        updateData.exclude_from_amazon_export = getFlag('exclude_amazon', 'exclude_from_amazon_export')
        updateData.exclude_from_ebay_export = getFlag('exclude_ebay', 'exclude_from_ebay_export')
        updateData.exclude_from_reverb_export = getFlag('exclude_reverb', 'exclude_from_reverb_export')
        updateData.exclude_from_etsy_export = getFlag('exclude_etsy', 'exclude_from_etsy_export')
      }

      const payload = {
        ...model,
        ...updateData,
        marketplace_listings: listings
      }

      await modelsApi.update(id, payload)
      // Clean draft
      setBulkDrafts(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      // Set success status for individual save
      setRowSaveStatusById(prev => ({ ...prev, [id]: 'success' }))
      loadData()
    } catch (e) {
      console.error(e)
      setRowSaveStatusById(prev => ({ ...prev, [id]: 'error' }))
      alert("Save failed")
    } finally {
      setSavingRowId(null)
    }
  }

  const startRowEdit = (model: Model) => {
    const amazon = model.marketplace_listings?.find(l => l.marketplace === 'amazon')?.external_id || ''
    setEditingRowId(model.id)
    setEditingRowData({ asin: amazon, notes: model.model_notes || '' })
    setRowSaveError(null)
  }

  const cancelRowEdit = () => {
    setEditingRowId(null)
    setEditingRowData({ asin: '', notes: '' })
    setRowSaveError(null)
  }

  const saveRowEdit = async (id: number) => {
    try {
      const model = models.find(m => m.id === id)
      if (!model) return

      // Prepare Payload via cloning
      let listings = model.marketplace_listings ? [...model.marketplace_listings] : []
      // Handle ASIN
      if (editingRowData.asin.trim()) {
        listings = listings.filter(l => l.marketplace !== 'amazon')
        listings.push({ marketplace: 'amazon', external_id: editingRowData.asin.trim() } as any)
      } else {
        listings = listings.filter(l => l.marketplace !== 'amazon')
      }

      const payload = {
        ...model,
        model_notes: editingRowData.notes || null,
        marketplace_listings: listings
      }

      await modelsApi.update(id, payload)

      // Advance
      // Recalculate index from current filtered list
      const currentIndex = filteredModels.findIndex(m => m.id === id)
      if (currentIndex >= 0 && currentIndex < filteredModels.length - 1) {
        const nextModel = filteredModels[currentIndex + 1]
        startRowEdit(nextModel)
      } else {
        cancelRowEdit()
      }

      loadData()

    } catch (e) {
      console.error("Row save failed", e)
      setRowSaveError("Save failed")
    }
  }

  // Selection Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const ids = new Set(filteredModels.map(m => m.id))
      setSelectedModelIds(ids)
    } else {
      setSelectedModelIds(new Set())
    }
  }

  const handleSelectRow = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedModelIds)
    if (checked) newSelected.add(id)
    else newSelected.delete(id)
    setSelectedModelIds(newSelected)
  }

  // Bulk Apply
  const handleBulkApply = async () => {
    // Validation
    if (bulkEditState.measurements.enabled) {
      const { width, depth, height } = bulkEditState.measurements
      if (!width || !depth || !height || width <= 0 || depth <= 0 || height <= 0) {
        alert("Default Measurements: All dimensions are required and must be > 0.")
        return
      }
    }
    if (bulkEditState.amazonAsin.enabled && bulkEditState.amazonAsin.mode === 'set' && !bulkEditState.amazonAsin.value.trim()) {
      alert("Amazon ASIN: Value is required when mode is 'Set'.")
      return
    }
    if (bulkEditState.notes.enabled && (bulkEditState.notes.mode === 'replace' || bulkEditState.notes.mode === 'append') && !bulkEditState.notes.value.trim()) {
      alert("Model Notes: Value is required.")
      return
    }

    setBulkEditApplying(true)
    const targets = Array.from(selectedModelIds)
    const failures: number[] = []

    // Loop and update
    for (const id of targets) {
      try {
        // 1. Get current model data (safest)
        const model = models.find(m => m.id === id)
        if (!model) continue

        // 2. Prepare Payload
        // Clone existing listings
        let listings = model.marketplace_listings ? [...model.marketplace_listings] : []

        // Apply ASIN
        if (bulkEditState.amazonAsin.enabled) {
          if (bulkEditState.amazonAsin.mode === 'set') {
            // Remove existing amazon
            listings = listings.filter(l => l.marketplace !== 'amazon')
            listings.push({ marketplace: 'amazon', external_id: bulkEditState.amazonAsin.value.trim() } as any)
          } else if (bulkEditState.amazonAsin.mode === 'clear') {
            listings = listings.filter(l => l.marketplace !== 'amazon')
          }
        }

        // Apply Measurements
        let dimUpdate = {}
        if (bulkEditState.measurements.enabled) {
          dimUpdate = {
            width: Number(bulkEditState.measurements.width),
            depth: Number(bulkEditState.measurements.depth),
            height: Number(bulkEditState.measurements.height)
          }
        }

        // Apply Notes
        let notesUpdate = {}
        if (bulkEditState.notes.enabled) {
          let newNotes = model.model_notes || ''
          const val = bulkEditState.notes.value
          if (bulkEditState.notes.mode === 'replace') newNotes = val
          else if (bulkEditState.notes.mode === 'append') newNotes = newNotes ? newNotes + '\n' + val : val
          else if (bulkEditState.notes.mode === 'clear') newNotes = ''

          notesUpdate = { model_notes: newNotes || null }
        }

        // Apply Export Exclusions
        let exclusionUpdate = {}
        if (bulkEditState.exportExclusion.enabled) {
          exclusionUpdate = {
            exclude_from_amazon_export: bulkEditState.exportExclusion.exclude_amazon,
            exclude_from_ebay_export: bulkEditState.exportExclusion.exclude_ebay,
            exclude_from_reverb_export: bulkEditState.exportExclusion.exclude_reverb,
            exclude_from_etsy_export: bulkEditState.exportExclusion.exclude_etsy
          }
        }

        const payload = {
          ...model,
          ...dimUpdate,
          ...notesUpdate,
          ...exclusionUpdate,
          marketplace_listings: listings
        }

        await modelsApi.update(id, payload)

      } catch (e) {
        console.error(`Failed to update model ${id}`, e)
        failures.push(id)
      }
    }

    setBulkEditApplying(false)
    setBulkEditOpen(false)

    if (failures.length === 0) {
      alert(`Successfully updated ${targets.length} models.`)
      setSelectedModelIds(new Set()) // Deselect all
      loadData()
    } else {
      alert(`Updated ${targets.length - failures.length} models. Failed: ${failures.length}. Check console.`)
      loadData()
    }
  }

  const ALLOWED_HANDLE_TYPES = new Set([
    'guitar amplifier',
    'bass amplifier',
    'keyboard amplifier',
    'cabinet',
    'combo amp',
    'head'
  ])

  const [availableDesignOptions, setAvailableDesignOptions] = useState<DesignOption[]>([])

  // STEP 1: Handle Measurement Option Lookup (Runtime, NO hardcoded IDs)
  const handleMeasurementOptions = useMemo(() => {
    const lookup: Record<string, DesignOption | undefined> = {}

    // Top Handle - EXACT names
    lookup['Top Handle Length'] = availableDesignOptions.find(o => o.name === 'Top Handle Length')
    lookup['Top Handle Height'] = availableDesignOptions.find(o => o.name === 'Top Handle Height')
    lookup['Top Handle: Rear Edge to Center'] = availableDesignOptions.find(o => o.name === 'Top Handle: Rear Edge to Center')

    // Side Handle - EXACT names
    lookup['Side Handle Width'] = availableDesignOptions.find(o => o.name === 'Side Handle Width')
    lookup['Side Handle Height'] = availableDesignOptions.find(o => o.name === 'Side Handle Height')
    lookup['Side Handle Top Edge to Center'] = availableDesignOptions.find(o => o.name === 'Side Handle Top Edge to Center')
    lookup['Side Handle Rear Edge to Center'] = availableDesignOptions.find(o => o.name === 'Side Handle Rear Edge to Center')

    return lookup
  }, [availableDesignOptions])

  useEffect(() => {
    setTextOptionValues({})
    if (formData.equipment_type_id) {
      equipmentTypesApi.getDesignOptions(formData.equipment_type_id)
        .then(options => {
          setAvailableDesignOptions(options)
          // No auto-selection of angle type - user must explicitly choose
        })
        .catch(err => {
          console.error("Failed to load design options", err)
          setAvailableDesignOptions([])
        })
    } else {
      setAvailableDesignOptions([])
    }
  }, [formData.equipment_type_id])

  const loadData = async () => {
    const [modelsData, seriesData, manufacturersData, equipmentTypesData, _handleLocData] = await Promise.all([
      modelsApi.list(filterSeries || undefined),
      seriesApi.list(),
      manufacturersApi.list(),
      equipmentTypesApi.list(),
      enumsApi.handleLocations()
    ])
    setModels(modelsData)
    setSeries(seriesData)
    setManufacturers(manufacturersData)
    setEquipmentTypes(equipmentTypesData)
    // setHandleLocations(handleLocData)
    // setAngleTypes(angleTypesData)
  }

  useEffect(() => {
    const mid = searchParams.get('manufacturerId')
    const sid = searchParams.get('seriesId')
    if (mid) setFilterManufacturer(Number(mid))
    // Only set series if it's new, to avoid loops if needed, though react state handles strictly equal primitives nicely
    if (sid) setFilterSeries(Number(sid))
  }, [searchParams])

  useEffect(() => {
    loadData()
  }, [filterSeries])

  const filteredModels = useMemo(() => {
    // 0. Empty State: If no filters, show nothing (UI consistency with ExportGrid)
    if (!filterManufacturer && !filterSeries) {
      return []
    }

    let result = [...models] // Clone to sort safely

    // 1. Filter by Manufacturer (if strictly filtering from a larger set)
    if (filterManufacturer) {
      const manufacturerSeriesIds = new Set(
        series.filter(s => s.manufacturer_id === filterManufacturer).map(s => s.id)
      )
      result = result.filter(m => manufacturerSeriesIds.has(m.series_id))
    }

    // 2. Filter by Series (Redundant if API handled it, but robust for local updates)
    if (filterSeries) {
      result = result.filter(m => m.series_id === filterSeries)
    }

    // 3. Sort: Series Name (A-Z) -> Model Name (A-Z)
    return result.sort((a, b) => {
      const seriesA = series.find(s => s.id === a.series_id)?.name || ''
      const seriesB = series.find(s => s.id === b.series_id)?.name || ''

      const seriesCompare = seriesA.localeCompare(seriesB, undefined, { sensitivity: 'base' })
      if (seriesCompare !== 0) return seriesCompare

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  }, [models, filterManufacturer, filterSeries, series])

  const getSeriesWithManufacturer = (seriesId: number) => {
    const s = series.find(x => x.id === seriesId)
    if (!s) return 'Unknown'
    const m = manufacturers.find(x => x.id === s.manufacturer_id)
    return m ? `${m.name} - ${s.name}` : s.name
  }

  const handleSave = async () => {
    // Validate minimum requirements first
    if (!validateForm()) {
      return  // Prevent save if validation fails
    }

    // STEP 4: SAVE PAYLOAD - Include design_option_values
    const design_option_values: Record<number, string> = {}

    // Convert textOptionValues to the format backend expects
    Object.entries(textOptionValues).forEach(([id, value]) => {
      if (value && value.trim() !== '') {
        design_option_values[Number(id)] = value
      }
    })

    // Convert dimensions to inches if currently in mm mode
    const dimensionsInInches = {
      width: formData.dimensionUnit === 'mm' ? mmToInches(formData.width) : formData.width,
      depth: formData.dimensionUnit === 'mm' ? mmToInches(formData.depth) : formData.depth,
      height: formData.dimensionUnit === 'mm' ? mmToInches(formData.height) : formData.height
    }

    const data = {
      ...formData,
      ...dimensionsInInches,  // Use converted dimensions
      handle_length: formData.handle_length || undefined,
      handle_width: formData.handle_width || undefined,
      image_url: formData.image_url || undefined,
      sku_override: formData.sku_override.trim() !== '' ? formData.sku_override.trim() : null,
      // Only send handle_location if user selected a value (not placeholder 'none')
      handle_location: formData.handle_location && formData.handle_location !== 'none'
        ? formData.handle_location
        : undefined,
      // Only send angle_type if user selected a value (not placeholder 'No Angle')  
      angle_type: formData.angle_type && formData.angle_type !== 'No Angle'
        ? formData.angle_type
        : undefined,
      handle_location_option_id: formData.handle_location_option_id,
      angle_type_option_id: formData.angle_type_option_id,
      top_handle_length_in: formData.top_handle_length_in,
      top_handle_height_in: formData.top_handle_height_in,
      top_handle_rear_edge_to_center_in: formData.top_handle_rear_edge_to_center_in,
      model_notes: formData.model_notes || null,  // PART B: Include model notes
      design_option_values: design_option_values,
      marketplace_listings: [
        formData.marketplace_listings_amazon_external_id && {
          marketplace: 'amazon',
          external_id: formData.marketplace_listings_amazon_external_id.trim()
        },
        formData.marketplace_listings_ebay_external_id && {
          marketplace: 'ebay',
          external_id: formData.marketplace_listings_ebay_external_id.trim()
        },
        formData.marketplace_listings_reverb_external_id && {
          marketplace: 'reverb',
          external_id: formData.marketplace_listings_reverb_external_id.trim()
        },
        formData.marketplace_listings_etsy_external_id && {
          marketplace: 'etsy',
          external_id: formData.marketplace_listings_etsy_external_id.trim()
        }
      ].filter(Boolean),
      amazon_a_plus_content: [
        {
          content_type: 'BRAND_STORY',
          is_uploaded: formData.aplus_brand_story_uploaded,
          notes: formData.aplus_brand_story_notes || null
        },
        {
          content_type: 'EBC',
          is_uploaded: formData.aplus_ebc_uploaded,
          notes: formData.aplus_ebc_notes || null
        }
      ],
      exclude_from_amazon_export: formData.exclude_from_amazon_export,
      exclude_from_ebay_export: formData.exclude_from_ebay_export,
      exclude_from_reverb_export: formData.exclude_from_reverb_export,
      exclude_from_etsy_export: formData.exclude_from_etsy_export
    } as any

    // Console logs for verification
    console.log('[SAVE] marketplace_listings', data.marketplace_listings)
    console.log('[SAVE] marketplace_listings', data.marketplace_listings)
    console.log('[SAVE] design_option_values', data.design_option_values)
    console.log('[ModelsPage] FULL PAYLOAD:', JSON.stringify(data, null, 2))

    setIsSaving(true)  // Disable save button

    try {
      let savedModel: Model

      console.log(`[ModelsPage] Sending ${editingModel ? 'UPDATE' : 'CREATE'} request...`)

      if (editingModel) {
        savedModel = await modelsApi.update(editingModel.id, data)
        console.log('[ModelsPage] UPDATE response received:', savedModel)
        setModels(prev => prev.map(m => m.id === savedModel.id ? savedModel : m))
        setEditingModel(savedModel)
        alert('Model updated successfully!')  // TODO: Replace with toast/snackbar
      } else {
        savedModel = await modelsApi.create(data)
        console.log('[ModelsPage] CREATE response received:', savedModel)
        setModels(prev => [...prev, savedModel])
        alert('Model saved successfully!')  // TODO: Replace with toast/snackbar
      }

      // Success: close modal and refresh
      setDialogOpen(false)
      resetForm()
      loadData()  // Refresh full list to ensure consistency

    } catch (error: any) {
      // Error: keep modal open and show error
      console.error('[ModelsPage] SAVE FAILED:', error)

      let errorMessage = 'Save failed: Unknown error'

      if (error.response) {
        console.error('[ModelsPage] Error response status:', error.response.status)
        console.error('[ModelsPage] Error response data:', error.response.data)

        if (error.response.data?.detail) {
          if (typeof error.response.data.detail === 'string') {
            errorMessage = `Save failed: ${error.response.data.detail}`
          } else if (error.response.data.detail.errors) {
            errorMessage = `Save failed: ${error.response.data.detail.errors.join(', ')}`
          } else if (error.response.data.detail.message) {
            errorMessage = `Save failed: ${error.response.data.detail.message}`
          }
        }
      } else if (error.message) {
        errorMessage = `Save failed: ${error.message}`
      }

      alert(errorMessage)  // TODO: Replace with toast/snackbar
      // DO NOT close modal - keep it open so user can fix the error

    } finally {
      setIsSaving(false)  // Re-enable save button
    }
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
      series_id: filterSeries ? Number(filterSeries) : 0,
      equipment_type_id: 0,
      width: 0,
      depth: 0,
      height: 0,
      handle_length: 0,
      handle_width: 0,
      handle_location: 'none',
      angle_type: 'No Angle',
      image_url: '',
      parent_sku: '',
      sku_override: '',
      handle_location_option_id: null,
      angle_type_option_id: null,
      top_handle_length_in: null,
      top_handle_height_in: null,
      top_handle_rear_edge_to_center_in: null,
      model_notes: '',  // PART B: Reset model notes
      selectedMarketplace: 'amazon',
      marketplace_listings_amazon_external_id: '',
      marketplace_listings_ebay_external_id: '',
      marketplace_listings_reverb_external_id: '',
      marketplace_listings_etsy_external_id: '',
      aplus_brand_story_uploaded: false,
      aplus_brand_story_notes: '',
      aplus_ebc_uploaded: false,
      aplus_ebc_notes: '',
      exclude_from_amazon_export: false,
      exclude_from_ebay_export: false,
      exclude_from_reverb_export: false,
      exclude_from_etsy_export: false,
      dimensionUnit: 'inches' as 'inches' | 'mm'
    })
    setTextOptionValues({})
    setValidationErrors([])  // Clear validation errors
    // Clear textOptionValues on reset
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
      image_url: model.image_url || '',
      parent_sku: model.parent_sku || '',
      sku_override: model.sku_override || '',
      handle_location_option_id: model.handle_location_option_id || null,
      angle_type_option_id: model.angle_type_option_id || null,
      top_handle_length_in: model.top_handle_length_in || null,
      top_handle_height_in: model.top_handle_height_in || null,
      top_handle_rear_edge_to_center_in: model.top_handle_rear_edge_to_center_in || null,
      model_notes: model.model_notes || '',  // PART B: Load model notes
      selectedMarketplace: 'amazon',
      marketplace_listings_amazon_external_id: model.marketplace_listings?.find(ml => ml.marketplace === 'amazon')?.external_id || '',
      marketplace_listings_ebay_external_id: model.marketplace_listings?.find(ml => ml.marketplace === 'ebay')?.external_id || '',
      marketplace_listings_reverb_external_id: model.marketplace_listings?.find(ml => ml.marketplace === 'reverb')?.external_id || '',
      marketplace_listings_etsy_external_id: model.marketplace_listings?.find(ml => ml.marketplace === 'etsy')?.external_id || '',
      aplus_brand_story_uploaded: model.amazon_a_plus_content?.find(c => c.content_type === 'BRAND_STORY')?.is_uploaded ?? false,
      aplus_brand_story_notes: model.amazon_a_plus_content?.find(c => c.content_type === 'BRAND_STORY')?.notes || '',
      aplus_ebc_uploaded: model.amazon_a_plus_content?.find(c => c.content_type === 'EBC')?.is_uploaded ?? false,
      aplus_ebc_notes: model.amazon_a_plus_content?.find(c => c.content_type === 'EBC')?.notes || '',
      exclude_from_amazon_export: model.exclude_from_amazon_export || false,
      exclude_from_ebay_export: model.exclude_from_ebay_export || false,
      exclude_from_reverb_export: model.exclude_from_reverb_export || false,
      exclude_from_etsy_export: model.exclude_from_etsy_export || false,
      dimensionUnit: 'inches' as 'inches' | 'mm'  // Always load dimensions in inches from DB
    })

    // Console log for load
    console.log('[LOAD] marketplace_listings', model.marketplace_listings || [])

    // STEP 5: LOAD / EDIT - Populate textOptionValues from design_option_values
    const loadedTextOptions: Record<number, string> = {}
    if ((model as any).design_option_values) {
      console.log('[LOAD] design_option_values', (model as any).design_option_values)
      const optionValues = (model as any).design_option_values
      if (typeof optionValues === 'object') {
        Object.entries(optionValues).forEach(([key, value]) => {
          loadedTextOptions[Number(key)] = String(value)
        })
      }
    }
    setTextOptionValues(loadedTextOptions)

    setDialogOpen(true)
  }

  const selectedEquipmentType = equipmentTypes.find(et => et.id === formData.equipment_type_id)
  const normalize = (s: string) => s.toLowerCase().trim()
  const showHandleFields = selectedEquipmentType && ALLOWED_HANDLE_TYPES.has(normalize(selectedEquipmentType.name))

  const handleLocationOptions = useMemo(() => {
    return availableDesignOptions
      .filter(o => o.option_type === 'handle_location')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [availableDesignOptions])

  const angleTypeOptions = useMemo(() => {
    return availableDesignOptions
      .filter(o => o.option_type === 'angle_type')
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [availableDesignOptions])

  // STEP 2: Progressive Disclosure - Visibility Conditions
  const hasHandleLocation = !!formData.handle_location_option_id

  const selectedAngleTypeOption = useMemo(() => {
    return angleTypeOptions.find(o => o.id === formData.angle_type_option_id)
  }, [angleTypeOptions, formData.angle_type_option_id])

  const angleTypeName = selectedAngleTypeOption?.name ?? null
  const hasAngleSelection = !!angleTypeName
  const hasAngle = hasAngleSelection && angleTypeName !== 'No Angle'

  // Separate Angle Drop and Top Depth from generic text options
  const angleDropOption = useMemo(() =>
    availableDesignOptions.find(o => o.option_type === 'text_option' && o.name === 'Angle Drop'),
    [availableDesignOptions]
  )

  const topDepthOption = useMemo(() =>
    availableDesignOptions.find(o => o.option_type === 'text_option' && o.name === 'Top Depth'),
    [availableDesignOptions]
  )

  // Filter generic text options (exclude handle measurements AND angle-related fields)
  const textOptions = useMemo(() => {
    const excludedNames = new Set([
      'Top Handle Length',
      'Top Handle Height',
      'Top Handle: Rear Edge to Center',
      'Side Handle Width',
      'Side Handle Height',
      'Side Handle Top Edge to Center',
      'Side Handle Rear Edge to Center',
      'Angle Drop',  // These now have dedicated UI
      'Top Depth'    // These now have dedicated UI
    ])

    return availableDesignOptions
      .filter(o => o.option_type === 'text_option' && !excludedNames.has(o.name))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [availableDesignOptions])

  // STEP 2: Visibility Logic - Based on handle location selection + option existence
  const selectedHandleLocationOption = useMemo(() => {
    return handleLocationOptions.find(o => o.id === formData.handle_location_option_id)
  }, [handleLocationOptions, formData.handle_location_option_id])

  const selectedHandleLocationName = selectedHandleLocationOption?.name || ''

  // Top Handle block renders when: handle location includes "Top" AND at least one Top option exists
  const showTopHandleBlock = useMemo(() => {
    if (!selectedHandleLocationName.includes('Top')) return false
    const hasAnyTopOption = handleMeasurementOptions['Top Handle Length'] ||
      handleMeasurementOptions['Top Handle Height'] ||
      handleMeasurementOptions['Top Handle: Rear Edge to Center']
    return !!hasAnyTopOption
  }, [selectedHandleLocationName, handleMeasurementOptions])

  // Side Handle block renders when: handle location includes "Side" AND at least one Side option exists
  const showSideHandleBlock = useMemo(() => {
    if (!selectedHandleLocationName.includes('Side')) return false
    const hasAnySideOption = handleMeasurementOptions['Side Handle Width'] ||
      handleMeasurementOptions['Side Handle Height'] ||
      handleMeasurementOptions['Side Handle Top Edge to Center'] ||
      handleMeasurementOptions['Side Handle Rear Edge to Center']
    return !!hasAnySideOption
  }, [selectedHandleLocationName, handleMeasurementOptions])

  // Minimum Save Requirements Validation
  const isFormValid = useMemo(() => {
    return !!(
      formData.series_id &&
      formData.name.trim() !== '' &&
      formData.equipment_type_id
    )
  }, [formData.series_id, formData.name, formData.equipment_type_id])

  const validateForm = () => {
    const errors: string[] = []
    if (!formData.series_id) errors.push('Series is required')
    if (!formData.name.trim()) errors.push('Model name is required')
    if (!formData.equipment_type_id) errors.push('Equipment type is required')
    setValidationErrors(errors)
    return errors.length === 0
  }

  // Helper variables for Select All checkbox
  const visibleIds = filteredModels.map(m => m.id)
  const visibleSelectedCount = visibleIds.filter(id => selectedBulkSaveIds.has(id)).length
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length
  const someVisibleSelected = visibleSelectedCount > 0 && visibleSelectedCount < visibleIds.length

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          {filterManufacturer && (
            <Button
              startIcon={<ArrowBackIcon />}
              sx={{ mb: 1, pl: 0, justifyContent: 'flex-start' }}
              onClick={() => navigate(`/manufacturers?manufacturerId=${filterManufacturer}&seriesId=${filterSeries || ''}`)}
            >
              Back to Manufacturers & Series
            </Button>
          )}
          <Typography variant="h4">Models</Typography>
          {/* Context Text */}
          <Box sx={{ mt: 1 }}>
            {filterManufacturer && (
              <Typography variant="subtitle1" color="primary" sx={{ lineHeight: 1.2 }}>
                Viewing Manufacturer: <strong>{manufacturers.find(m => m.id === filterManufacturer)?.name}</strong>
              </Typography>
            )}
            {filterSeries && (
              <Typography variant="subtitle1" color="primary" sx={{ lineHeight: 1.2 }}>
                Viewing Series: <strong>{series.find(s => s.id === filterSeries)?.name}</strong>
              </Typography>
            )}
          </Box>
        </Box>
        <Box>
          {false && (
            <Button
              variant="outlined"
              onClick={() => setBulkEditOpen(true)}
              disabled={selectedModelIds.size === 0}
              sx={{ mr: 2 }}
            >
              Bulk Edit ({selectedModelIds.size})
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<MonetizationOnIcon />}
            onClick={() => setPricingAdminOpen(true)}
            sx={{ mr: 2 }}
          >
            Pricing Admin
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => {
            resetForm()
            setDialogOpen(true)
          }}>
            Add Model
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter by Manufacturer</InputLabel>
              <Select
                value={filterManufacturer}
                label="Filter by Manufacturer"
                onChange={(e) => {
                  setFilterManufacturer(e.target.value as number | '');
                  setFilterSeries(''); // Clear series when manufacturer changes
                }}
              >
                <MenuItem value="">All Manufacturers</MenuItem>
                {[...manufacturers]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((m) => (
                    <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter by Series</InputLabel>
              <Select
                value={filterSeries}
                label="Filter by Series"
                onChange={(e) => setFilterSeries(e.target.value as number | '')}
              >
                <MenuItem value="">All Series</MenuItem>
                {series
                  .filter(s => !filterManufacturer || s.manufacturer_id === filterManufacturer)
                  .sort((a, b) => getSeriesWithManufacturer(a.id).localeCompare(getSeriesWithManufacturer(b.id)))
                  .map((s) => (
                    <MenuItem key={s.id} value={s.id}>{getSeriesWithManufacturer(s.id)}</MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        {/* Bulk Edit Columns Selector */}
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Bulk Edit Columns (Select up to 2)</Typography>
          <FormGroup row>
            <FormControlLabel
              control={<Checkbox checked={selectedBulkColumns.has('amazon_asin')} onChange={() => handleColumnToggle('amazon_asin')} disabled={isBulkEditMode} />}
              label="Amazon ASIN"
            />
            <FormControlLabel
              control={<Checkbox checked={selectedBulkColumns.has('model_notes')} onChange={() => handleColumnToggle('model_notes')} disabled={isBulkEditMode} />}
              label="Model Notes"
            />
            <FormControlLabel
              control={<Checkbox checked={selectedBulkColumns.has('dimensions')} onChange={() => handleColumnToggle('dimensions')} disabled={isBulkEditMode} />}
              label="Dimensions"
            />
            <FormControlLabel
              control={<Checkbox checked={selectedBulkColumns.has('equipment_type')} onChange={() => handleColumnToggle('equipment_type')} disabled={isBulkEditMode || equipmentTypes.length === 0} />}
              label="Equipment Type"
            />
            <FormControlLabel
              control={<Checkbox checked={selectedBulkColumns.has('ebay_id')} onChange={() => handleColumnToggle('ebay_id')} disabled={isBulkEditMode} />}
              label="eBay ID"
            />
            <FormControlLabel
              control={<Checkbox checked={selectedBulkColumns.has('reverb_id')} onChange={() => handleColumnToggle('reverb_id')} disabled={isBulkEditMode} />}
              label="Reverb ID"
            />
            <FormControlLabel
              control={<Checkbox checked={selectedBulkColumns.has('aplus_brand_story')} onChange={() => handleColumnToggle('aplus_brand_story')} disabled={isBulkEditMode || models.length === 0} />}
              label="A+ Brand Story"
            />
            <FormControlLabel
              control={<Checkbox checked={selectedBulkColumns.has('aplus_ebc')} onChange={() => handleColumnToggle('aplus_ebc')} disabled={isBulkEditMode || models.length === 0} />}
              label="A+ EBC"
            />
            <FormControlLabel
              control={<Checkbox checked={selectedBulkColumns.has('export_exclusions')} onChange={() => handleColumnToggle('export_exclusions')} disabled={isBulkEditMode} />}
              label="Export Exclusions"
            />
          </FormGroup>
          {selectedBulkColumns.size >= 2 && !isBulkEditMode && (
            <FormHelperText>Max 2 columns selected.</FormHelperText>
          )}
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
            <Button
              variant="contained"
              size="small"
              onClick={() => setIsBulkEditMode(!isBulkEditMode)}
              disabled={selectedBulkColumns.size === 0}
              color={isBulkEditMode ? 'warning' : 'primary'}
            >
              {isBulkEditMode ? 'Exit Bulk Edit' : 'Start Bulk Edit'}
            </Button>
            {selectedBulkColumns.size > 0 && (
              <Button
                variant="text"
                size="small"
                onClick={() => {
                  setSelectedBulkColumns(new Set())
                  setIsBulkEditMode(false)
                  setBulkDrafts({})
                }}
              >
                Clear Selection
              </Button>
            )}
            {isBulkEditMode && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleSelectChanged}
                >
                  Select Changed
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="success"
                  onClick={handleSaveAll}
                  disabled={selectedBulkSaveIds.size === 0 || saveAllStatus === 'saving'}
                  startIcon={saveAllStatus === 'saving' ? <SaveIcon /> : undefined}
                >
                  {saveAllStatus === 'saving' ? 'Saving...' : `Save All (${selectedBulkSaveIds.size})`}
                </Button>
                {saveAllStatus === 'success' && (
                  <Typography variant="caption" color="success.main">
                    Save successful.
                  </Typography>
                )}
              </>
            )}
          </Stack>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {isBulkEditMode && (
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allVisibleSelected}
                    indeterminate={someVisibleSelected}
                    disabled={visibleIds.length === 0}
                    onChange={handleToggleSelectAllVisible}
                  />
                </TableCell>
              )}
              <TableCell>Model Name</TableCell>
              {isBulkEditMode && <TableCell>Series</TableCell>}

              {isBulkEditMode && selectedBulkColumns.has('amazon_asin') && <TableCell>Amazon ASIN</TableCell>}
              {isBulkEditMode && selectedBulkColumns.has('model_notes') && <TableCell>Model Notes</TableCell>}
              {isBulkEditMode && selectedBulkColumns.has('dimensions') && (
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2">Dimensions (W x D x H)</Typography>
                    <ToggleButtonGroup
                      value={bulkDimensionUnit}
                      exclusive
                      onChange={(_, newUnit) => {
                        if (!newUnit) return;

                        // Convert all existing bulk draft dimensions when switching units
                        const updatedDrafts: Record<number, any> = {};
                        filteredModels.forEach(model => {
                          const draft = bulkDrafts[model.id];
                          if (draft && (draft.width !== undefined || draft.depth !== undefined || draft.height !== undefined)) {
                            const currentWidth = draft.width !== undefined ? draft.width : model.width;
                            const currentDepth = draft.depth !== undefined ? draft.depth : model.depth;
                            const currentHeight = draft.height !== undefined ? draft.height : model.height;

                            updatedDrafts[model.id] = {
                              ...draft,
                              width: newUnit === 'mm' ? inchesToMm(currentWidth) : mmToInches(currentWidth),
                              depth: newUnit === 'mm' ? inchesToMm(currentDepth) : mmToInches(currentDepth),
                              height: newUnit === 'mm' ? inchesToMm(currentHeight) : mmToInches(currentHeight)
                            };
                          }
                        });

                        if (Object.keys(updatedDrafts).length > 0) {
                          setBulkDrafts(prev => ({ ...prev, ...updatedDrafts }));
                        }
                        setBulkDimensionUnit(newUnit);
                      }}
                      size="small"
                      aria-label="bulk dimension unit"
                    >
                      <ToggleButton value="inches" aria-label="inches" sx={{ py: 0.25, px: 1, fontSize: '0.75rem' }}>
                        in
                      </ToggleButton>
                      <ToggleButton value="mm" aria-label="millimeters" sx={{ py: 0.25, px: 1, fontSize: '0.75rem' }}>
                        mm
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                </TableCell>
              )}
              {isBulkEditMode && selectedBulkColumns.has('equipment_type') && <TableCell>Equipment Type</TableCell>}
              {isBulkEditMode && selectedBulkColumns.has('ebay_id') && <TableCell>eBay ID</TableCell>}
              {isBulkEditMode && selectedBulkColumns.has('reverb_id') && <TableCell>Reverb ID</TableCell>}
              {isBulkEditMode && selectedBulkColumns.has('aplus_brand_story') && <TableCell>Brand Story</TableCell>}
              {isBulkEditMode && selectedBulkColumns.has('aplus_ebc') && <TableCell>EBC</TableCell>}
              {isBulkEditMode && selectedBulkColumns.has('export_exclusions') && <TableCell>Export Exclusions</TableCell>}

              {!isBulkEditMode && (
                <>
                  <TableCell>Series</TableCell>
                  <TableCell>Manufacturer</TableCell>
                  <TableCell>Dimensions (W x D x H)</TableCell>
                </>
              )}
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredModels.map((model) => (
              <TableRow key={model.id} selected={selectedModelIds.has(model.id)}>
                {isBulkEditMode && (
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedBulkSaveIds.has(model.id)}
                      onChange={() => handleToggleBulkSaveSelection(model.id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Stack spacing={0.25}>
                    {model.name}
                    {/* Amazon ASIN */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                      Amazon: {model.marketplace_listings?.find(l => l.marketplace === 'amazon')?.external_id || '-'}
                    </Typography>
                    {/* A+ Content Status */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                      Brand Story: {model.amazon_a_plus_content?.find(c => c.content_type === 'BRAND_STORY')?.is_uploaded ? 'Yes' : 'No'}
                      {' • '}
                      EBC: {model.amazon_a_plus_content?.find(c => c.content_type === 'EBC')?.is_uploaded ? 'Yes' : 'No'}
                    </Typography>
                  </Stack>
                </TableCell>
                {isBulkEditMode && <TableCell>{series.find(s => s.id === model.series_id)?.name || 'Unknown'}</TableCell>}

                {isBulkEditMode && selectedBulkColumns.has('amazon_asin') && (
                  <TableCell>
                    <TextField
                      size="small"
                      value={bulkDrafts[model.id]?.asin !== undefined ? bulkDrafts[model.id].asin : (model.marketplace_listings?.find(l => l.marketplace === 'amazon')?.external_id || '')}
                      onChange={(e) => handleBulkDraftChange(model.id, 'asin', e.target.value)}
                      placeholder="ASIN"
                      sx={{ minWidth: 100 }}
                    />
                  </TableCell>
                )}

                {isBulkEditMode && selectedBulkColumns.has('model_notes') && (
                  <TableCell>
                    <TextField
                      size="small" multiline minRows={2}
                      value={bulkDrafts[model.id]?.notes !== undefined ? bulkDrafts[model.id].notes : (model.model_notes || '')}
                      onChange={(e) => handleBulkDraftChange(model.id, 'notes', e.target.value)}
                      placeholder="Notes"
                      sx={{ minWidth: 150 }}
                    />
                  </TableCell>
                )}

                {isBulkEditMode && selectedBulkColumns.has('dimensions') && (
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>W</Typography>
                        <TextField size="small" sx={{ width: 130 }} type="number" placeholder="Width"
                          value={bulkDrafts[model.id]?.width !== undefined ? bulkDrafts[model.id].width : (bulkDimensionUnit === 'mm' ? inchesToMm(model.width) : model.width)}
                          onChange={(e) => {
                            const inputVal = parseFloat(e.target.value) || 0;
                            handleBulkDraftChange(model.id, 'width', inputVal);
                          }}
                          onBlur={() => {
                            if (bulkDimensionUnit === 'mm' && bulkDrafts[model.id]?.width) {
                              // Round up mm to whole number on blur
                              const roundedMm = Math.ceil(bulkDrafts[model.id].width);
                              handleBulkDraftChange(model.id, 'width', roundedMm);
                            }
                          }} />
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>D</Typography>
                        <TextField size="small" sx={{ width: 130 }} type="number" placeholder="Depth"
                          value={bulkDrafts[model.id]?.depth !== undefined ? bulkDrafts[model.id].depth : (bulkDimensionUnit === 'mm' ? inchesToMm(model.depth) : model.depth)}
                          onChange={(e) => {
                            const inputVal = parseFloat(e.target.value) || 0;
                            handleBulkDraftChange(model.id, 'depth', inputVal);
                          }}
                          onBlur={() => {
                            if (bulkDimensionUnit === 'mm' && bulkDrafts[model.id]?.depth) {
                              // Round up mm to whole number on blur
                              const roundedMm = Math.ceil(bulkDrafts[model.id].depth);
                              handleBulkDraftChange(model.id, 'depth', roundedMm);
                            }
                          }} />
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>H</Typography>
                        <TextField size="small" sx={{ width: 130 }} type="number" placeholder="Height"
                          value={bulkDrafts[model.id]?.height !== undefined ? bulkDrafts[model.id].height : (bulkDimensionUnit === 'mm' ? inchesToMm(model.height) : model.height)}
                          onChange={(e) => {
                            const inputVal = parseFloat(e.target.value) || 0;
                            handleBulkDraftChange(model.id, 'height', inputVal);
                          }}
                          onBlur={() => {
                            if (bulkDimensionUnit === 'mm' && bulkDrafts[model.id]?.height) {
                              // Round up mm to whole number on blur
                              const roundedMm = Math.ceil(bulkDrafts[model.id].height);
                              handleBulkDraftChange(model.id, 'height', roundedMm);
                            }
                          }} />
                      </Box>
                    </Stack>
                  </TableCell>
                )}

                {isBulkEditMode && selectedBulkColumns.has('equipment_type') && (
                  <TableCell>
                    <Select size="small"
                      value={bulkDrafts[model.id]?.equipment_type_id !== undefined ? bulkDrafts[model.id].equipment_type_id : model.equipment_type_id}
                      onChange={(e) => handleBulkDraftChange(model.id, 'equipment_type_id', e.target.value)}
                      sx={{ minWidth: 120 }}
                    >
                      {equipmentTypes.map(et => <MenuItem key={et.id} value={et.id}>{et.name}</MenuItem>)}
                    </Select>
                  </TableCell>
                )}

                {isBulkEditMode && selectedBulkColumns.has('ebay_id') && (
                  <TableCell>
                    <TextField
                      size="small"
                      value={bulkDrafts[model.id]?.ebay !== undefined ? bulkDrafts[model.id].ebay : (model.marketplace_listings?.find(l => l.marketplace === 'ebay')?.external_id || '')}
                      onChange={(e) => handleBulkDraftChange(model.id, 'ebay', e.target.value)}
                      placeholder="eBay ID"
                      sx={{ minWidth: 100 }}
                    />
                  </TableCell>
                )}

                {isBulkEditMode && selectedBulkColumns.has('reverb_id') && (
                  <TableCell>
                    <TextField
                      size="small"
                      value={bulkDrafts[model.id]?.reverb !== undefined ? bulkDrafts[model.id].reverb : (model.marketplace_listings?.find(l => l.marketplace === 'reverb')?.external_id || '')}
                      onChange={(e) => handleBulkDraftChange(model.id, 'reverb', e.target.value)}
                      placeholder="Reverb ID"
                      sx={{ minWidth: 100 }}
                    />
                  </TableCell>
                )}

                {isBulkEditMode && selectedBulkColumns.has('aplus_brand_story') && (
                  <TableCell sx={{ minWidth: 200 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={
                              bulkDrafts[model.id]?.aplus_brand_story_uploaded !== undefined
                                ? bulkDrafts[model.id].aplus_brand_story_uploaded
                                : (model.amazon_a_plus_content?.find(c => c.content_type === 'BRAND_STORY')?.is_uploaded || false)
                            }
                            onChange={(e) => handleBulkDraftChange(model.id, 'aplus_brand_story_uploaded', e.target.checked)}
                            size="small"
                          />
                        }
                        label="Uploaded"
                        componentsProps={{ typography: { variant: 'caption' } }}
                      />
                      <TextField
                        size="small"
                        placeholder="Notes / Version"
                        value={
                          bulkDrafts[model.id]?.aplus_brand_story_notes !== undefined
                            ? bulkDrafts[model.id].aplus_brand_story_notes
                            : (model.amazon_a_plus_content?.find(c => c.content_type === 'BRAND_STORY')?.notes || '')
                        }
                        onChange={(e) => handleBulkDraftChange(model.id, 'aplus_brand_story_notes', e.target.value)}
                        disabled={!(
                          bulkDrafts[model.id]?.aplus_brand_story_uploaded !== undefined
                            ? bulkDrafts[model.id].aplus_brand_story_uploaded
                            : (model.amazon_a_plus_content?.find(c => c.content_type === 'BRAND_STORY')?.is_uploaded || false)
                        )}
                      />
                    </Box>
                  </TableCell>
                )}
                {isBulkEditMode && selectedBulkColumns.has('aplus_ebc') && (
                  <TableCell sx={{ minWidth: 200 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={
                              bulkDrafts[model.id]?.aplus_ebc_uploaded !== undefined
                                ? bulkDrafts[model.id].aplus_ebc_uploaded
                                : (model.amazon_a_plus_content?.find(c => c.content_type === 'EBC')?.is_uploaded || false)
                            }
                            onChange={(e) => handleBulkDraftChange(model.id, 'aplus_ebc_uploaded', e.target.checked)}
                            size="small"
                          />
                        }
                        label="Uploaded"
                        componentsProps={{ typography: { variant: 'caption' } }}
                      />
                      <TextField
                        size="small"
                        placeholder="Notes / Version"
                        value={
                          bulkDrafts[model.id]?.aplus_ebc_notes !== undefined
                            ? bulkDrafts[model.id].aplus_ebc_notes
                            : (model.amazon_a_plus_content?.find(c => c.content_type === 'EBC')?.notes || '')
                        }
                        onChange={(e) => handleBulkDraftChange(model.id, 'aplus_ebc_notes', e.target.value)}
                        disabled={!(
                          bulkDrafts[model.id]?.aplus_ebc_uploaded !== undefined
                            ? bulkDrafts[model.id].aplus_ebc_uploaded
                            : (model.amazon_a_plus_content?.find(c => c.content_type === 'EBC')?.is_uploaded || false)
                        )}
                      />
                    </Box>
                  </TableCell>
                )}
                {isBulkEditMode && selectedBulkColumns.has('export_exclusions') && (
                  <TableCell sx={{ minWidth: 160 }}>
                    <FormGroup>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={bulkDrafts[model.id]?.exclude_amazon !== undefined ? bulkDrafts[model.id].exclude_amazon : (model.exclude_from_amazon_export || false)}
                            onChange={(e) => handleBulkDraftChange(model.id, 'exclude_amazon', e.target.checked)}
                            size="small"
                            sx={{ p: 0.5 }}
                          />
                        }
                        label="No Amazon"
                        componentsProps={{ typography: { variant: 'caption' } }}
                        sx={{ ml: 0, mr: 0, my: -0.5 }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={bulkDrafts[model.id]?.exclude_ebay !== undefined ? bulkDrafts[model.id].exclude_ebay : (model.exclude_from_ebay_export || false)}
                            onChange={(e) => handleBulkDraftChange(model.id, 'exclude_ebay', e.target.checked)}
                            size="small"
                            sx={{ p: 0.5 }}
                          />
                        }
                        label="No eBay"
                        componentsProps={{ typography: { variant: 'caption' } }}
                        sx={{ ml: 0, mr: 0, my: -0.5 }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={bulkDrafts[model.id]?.exclude_reverb !== undefined ? bulkDrafts[model.id].exclude_reverb : (model.exclude_from_reverb_export || false)}
                            onChange={(e) => handleBulkDraftChange(model.id, 'exclude_reverb', e.target.checked)}
                            size="small"
                            sx={{ p: 0.5 }}
                          />
                        }
                        label="No Reverb"
                        componentsProps={{ typography: { variant: 'caption' } }}
                        sx={{ ml: 0, mr: 0, my: -0.5 }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={bulkDrafts[model.id]?.exclude_etsy !== undefined ? bulkDrafts[model.id].exclude_etsy : (model.exclude_from_etsy_export || false)}
                            onChange={(e) => handleBulkDraftChange(model.id, 'exclude_etsy', e.target.checked)}
                            size="small"
                            sx={{ p: 0.5 }}
                          />
                        }
                        label="No Etsy"
                        componentsProps={{ typography: { variant: 'caption' } }}
                        sx={{ ml: 0, mr: 0, my: -0.5 }}
                      />
                    </FormGroup>
                  </TableCell>
                )}

                {!isBulkEditMode && (
                  <>
                    <TableCell>
                      <Stack spacing={0.25}>
                        {series.find(s => s.id === model.series_id)?.name || 'Unknown'}
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                          eBay: {model.marketplace_listings?.find(l => l.marketplace === 'ebay')?.external_id || '—'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                          Reverb: {model.marketplace_listings?.find(l => l.marketplace === 'reverb')?.external_id || '—'}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        {manufacturers.find(m => m.id === series.find(s => s.id === model.series_id)?.manufacturer_id)?.name || 'Unknown'}
                        {(() => {
                          const etName = equipmentTypes.find(et => et.id === model.equipment_type_id)?.name;
                          return etName ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                              {etName}
                            </Typography>
                          ) : null;
                        })()}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.25}>
                        {`${model.width}" x ${model.depth}" x ${model.height}"`}
                        {(() => {
                          const excluded: string[] = []
                          if (model.exclude_from_amazon_export) excluded.push('Amazon')
                          if (model.exclude_from_ebay_export) excluded.push('eBay')
                          if (model.exclude_from_reverb_export) excluded.push('Reverb')
                          if (model.exclude_from_etsy_export) excluded.push('Etsy')
                          if (excluded.length > 0) {
                            return (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                                Excluded: {excluded.join(', ')}
                              </Typography>
                            )
                          }
                          return null
                        })()}
                      </Stack>
                    </TableCell>
                  </>
                )}

                <TableCell align="right">
                  {isBulkEditMode ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      {savingRowId === model.id ? (
                        <CircularProgress size={24} />
                      ) : (
                        <IconButton onClick={() => handleRowBulkSave(model.id)} color="primary"><SaveIcon /></IconButton>
                      )}
                      {rowSaveStatusById[model.id] === 'success' && (
                        <Typography variant="caption" color="success.main">
                          Save successful.
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex' }}>
                      <Tooltip title="Pricing Analysis">
                        <IconButton onClick={() => setPricingModel(model)} color="info">
                          <MonetizationOnIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton onClick={() => openEdit(model)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDeleteClick(model.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredModels.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No models found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        TransitionProps={{
          onEntered: () => {
            if (formData.series_id) {
              modelNameInputRef.current?.focus()
            }
          }
        }}
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
          {validationErrors.length > 0 && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
              {validationErrors.map((error, index) => (
                <Typography key={index} variant="body2" color="error.dark">
                  • {error}
                </Typography>
              ))}
            </Box>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Series</InputLabel>
                <Select
                  value={formData.series_id || ''}
                  label="Series"
                  onChange={(e) => setFormData({ ...formData, series_id: e.target.value as number })}
                >
                  {series
                    .filter(s => !filterManufacturer || s.manufacturer_id === filterManufacturer)
                    .sort((a, b) => getSeriesWithManufacturer(a.id).localeCompare(getSeriesWithManufacturer(b.id)))
                    .map((s) => (
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
                inputRef={modelNameInputRef}
                fullWidth
                label="Model Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Base SKU (Generated)"
                value={formData.parent_sku}
                disabled
                helperText="Auto-generated. Used as the base SKU for single listings and as the parent SKU for variations. Not editable."
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="SKU Override (optional)"
                value={formData.sku_override}
                onChange={(e) => setFormData({ ...formData, sku_override: e.target.value })}
                helperText="If set, exports will use this SKU instead of the generated SKU."
              />
            </Grid>

            {/* Compact Marketplace Listings Section */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Marketplace Listings
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Marketplace</InputLabel>
                  <Select
                    value={formData.selectedMarketplace || 'amazon'}
                    label="Marketplace"
                    onChange={(e) => setFormData({ ...formData, selectedMarketplace: e.target.value })}
                  >
                    <MenuItem value="amazon">Amazon</MenuItem>
                    <MenuItem value="ebay">eBay</MenuItem>
                    <MenuItem value="reverb">Reverb</MenuItem>
                    <MenuItem value="etsy">Etsy</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label={
                    formData.selectedMarketplace === 'amazon' ? 'Amazon ASIN' :
                      formData.selectedMarketplace === 'ebay' ? 'eBay Item Number' :
                        formData.selectedMarketplace === 'reverb' ? 'Reverb Listing ID' :
                          'Etsy Listing ID'
                  }
                  value={
                    formData.selectedMarketplace === 'amazon' ? formData.marketplace_listings_amazon_external_id :
                      formData.selectedMarketplace === 'ebay' ? formData.marketplace_listings_ebay_external_id :
                        formData.selectedMarketplace === 'reverb' ? formData.marketplace_listings_reverb_external_id :
                          formData.marketplace_listings_etsy_external_id
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (formData.selectedMarketplace === 'amazon') {
                      setFormData({ ...formData, marketplace_listings_amazon_external_id: value });
                    } else if (formData.selectedMarketplace === 'ebay') {
                      setFormData({ ...formData, marketplace_listings_ebay_external_id: value });
                    } else if (formData.selectedMarketplace === 'reverb') {
                      setFormData({ ...formData, marketplace_listings_reverb_external_id: value });
                    } else {
                      setFormData({ ...formData, marketplace_listings_etsy_external_id: value });
                    }
                  }}
                  sx={{ width: 220 }}
                />
              </Box>

              {/* List of saved marketplace IDs */}
              {(formData.marketplace_listings_amazon_external_id || formData.marketplace_listings_ebay_external_id ||
                formData.marketplace_listings_reverb_external_id || formData.marketplace_listings_etsy_external_id) && (
                  <Box sx={{ mt: 1.5, ml: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      Current Listings:
                    </Typography>
                    {formData.marketplace_listings_amazon_external_id && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2">
                          <strong>Amazon:</strong> {formData.marketplace_listings_amazon_external_id}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              marketplace_listings_amazon_external_id: '',
                              selectedMarketplace: 'amazon'
                            });
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                    {formData.marketplace_listings_ebay_external_id && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2">
                          <strong>eBay:</strong> {formData.marketplace_listings_ebay_external_id}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              marketplace_listings_ebay_external_id: '',
                              selectedMarketplace: 'ebay'
                            });
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                    {formData.marketplace_listings_reverb_external_id && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2">
                          <strong>Reverb:</strong> {formData.marketplace_listings_reverb_external_id}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              marketplace_listings_reverb_external_id: '',
                              selectedMarketplace: 'reverb'
                            });
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                    {formData.marketplace_listings_etsy_external_id && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2">
                          <strong>Etsy:</strong> {formData.marketplace_listings_etsy_external_id}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              marketplace_listings_etsy_external_id: '',
                              selectedMarketplace: 'etsy'
                            });
                          }}
                          sx={{ p: 0.5 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                )}
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

            {/* Dimension Unit Toggle */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="subtitle2">Dimensions</Typography>
                <ToggleButtonGroup
                  value={formData.dimensionUnit}
                  exclusive
                  onChange={(_, newUnit) => {
                    if (!newUnit) return;

                    // Convert dimensions when switching units
                    const convertedWidth = newUnit === 'mm'
                      ? inchesToMm(formData.width)
                      : mmToInches(formData.width);
                    const convertedDepth = newUnit === 'mm'
                      ? inchesToMm(formData.depth)
                      : mmToInches(formData.depth);
                    const convertedHeight = newUnit === 'mm'
                      ? inchesToMm(formData.height)
                      : mmToInches(formData.height);

                    setFormData({
                      ...formData,
                      dimensionUnit: newUnit,
                      width: convertedWidth,
                      depth: convertedDepth,
                      height: convertedHeight
                    });
                  }}
                  size="small"
                  aria-label="dimension unit"
                >
                  <ToggleButton value="inches" aria-label="inches">
                    in
                  </ToggleButton>
                  <ToggleButton value="mm" aria-label="millimeters">
                    mm
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Grid>

            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label={formData.dimensionUnit === 'inches' ? 'Width (inches)' : 'Width (mm)'}
                value={formData.width || ''}
                onChange={(e) => setFormData({ ...formData, width: parseFloat(e.target.value) || 0 })}
                onBlur={() => {
                  if (formData.dimensionUnit === 'mm' && formData.width) {
                    // Round up mm to whole number on blur
                    const roundedMm = Math.ceil(formData.width);
                    setFormData({ ...formData, width: roundedMm });
                  }
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label={formData.dimensionUnit === 'inches' ? 'Depth (inches)' : 'Depth (mm)'}
                value={formData.depth || ''}
                onChange={(e) => setFormData({ ...formData, depth: parseFloat(e.target.value) || 0 })}
                onBlur={() => {
                  if (formData.dimensionUnit === 'mm' && formData.depth) {
                    // Round up mm to whole number on blur
                    const roundedMm = Math.ceil(formData.depth);
                    setFormData({ ...formData, depth: roundedMm });
                  }
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                type="number"
                label={formData.dimensionUnit === 'inches' ? 'Height (inches)' : 'Height (mm)'}
                value={formData.height || ''}
                onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) || 0 })}
                onBlur={() => {
                  if (formData.dimensionUnit === 'mm' && formData.height) {
                    // Round up mm to whole number on blur
                    const roundedMm = Math.ceil(formData.height);
                    setFormData({ ...formData, height: roundedMm });
                  }
                }}
              />
            </Grid>
            {showHandleFields && (
              <>
                <Grid item xs={6}>
                  <FormControl fullWidth disabled={handleLocationOptions.length === 0}>
                    <InputLabel>Handle Location</InputLabel>
                    <Select
                      value={formData.handle_location_option_id || ''}
                      label="Handle Location"
                      onChange={(e) => setFormData({ ...formData, handle_location_option_id: e.target.value ? Number(e.target.value) : null })}
                    >
                      {handleLocationOptions.map((opt) => (
                        <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {handleLocationOptions.length === 0 && (
                    <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        No handle options configured for this equipment type.
                      </Typography>
                      <Button
                        size="small"
                        sx={{ fontSize: '0.7rem', p: 0, minWidth: 'auto', textTransform: 'none' }}
                        onClick={() => navigate('/design-options')}
                      >
                        Configure
                      </Button>
                    </Box>
                  )}
                </Grid>

                {/* STEP 3: Handle Details - Show after Handle Location selected */}
                {hasHandleLocation && (
                  <>
                    {/* STEP 3: Top Handle Fields - Bind to textOptionValues */}
                    {showTopHandleBlock && (
                      <>
                        <Grid item xs={12} sx={{ mt: 1 }}>
                          <Typography variant="subtitle2" color="primary">Top Handle Details (Design Note)</Typography>
                          <Typography variant="caption" color="text.secondary">Used for sewing placement notes only.</Typography>
                        </Grid>
                        {handleMeasurementOptions['Top Handle Length'] && (
                          <Grid item xs={4}>
                            <TextField
                              fullWidth
                              label="Length (in)"
                              value={textOptionValues[handleMeasurementOptions['Top Handle Length'].id] ?? ''}
                              onChange={(e) => setTextOptionValues(prev => ({ ...prev, [handleMeasurementOptions['Top Handle Length']!.id]: e.target.value }))}
                            />
                          </Grid>
                        )}
                        {handleMeasurementOptions['Top Handle Height'] && (
                          <Grid item xs={4}>
                            <TextField
                              fullWidth
                              label="Height (in)"
                              value={textOptionValues[handleMeasurementOptions['Top Handle Height'].id] ?? ''}
                              onChange={(e) => setTextOptionValues(prev => ({ ...prev, [handleMeasurementOptions['Top Handle Height']!.id]: e.target.value }))}
                            />
                          </Grid>
                        )}
                        {handleMeasurementOptions['Top Handle: Rear Edge to Center'] && (
                          <Grid item xs={4}>
                            <TextField
                              fullWidth
                              label="Rear Edge → Center (in)"
                              value={textOptionValues[handleMeasurementOptions['Top Handle: Rear Edge to Center'].id] ?? ''}
                              onChange={(e) => setTextOptionValues(prev => ({ ...prev, [handleMeasurementOptions['Top Handle: Rear Edge to Center']!.id]: e.target.value }))}
                            />
                          </Grid>
                        )}
                      </>
                    )}

                    {/* STEP 3: Side Handle Fields - Bind to textOptionValues */}
                    {showSideHandleBlock && (
                      <>
                        <Grid item xs={12} sx={{ mt: 1 }}>
                          <Typography variant="subtitle2" color="primary">Side Handle Details (Design Note)</Typography>
                          <Typography variant="caption" color="text.secondary">Used for sewing placement notes only.</Typography>
                        </Grid>
                        {handleMeasurementOptions['Side Handle Width'] && (
                          <Grid item xs={3}>
                            <TextField
                              fullWidth
                              label="Width (in)"
                              value={textOptionValues[handleMeasurementOptions['Side Handle Width'].id] ?? ''}
                              onChange={(e) => setTextOptionValues(prev => ({ ...prev, [handleMeasurementOptions['Side Handle Width']!.id]: e.target.value }))}
                            />
                          </Grid>
                        )}
                        {handleMeasurementOptions['Side Handle Height'] && (
                          <Grid item xs={3}>
                            <TextField
                              fullWidth
                              label="Height (in)"
                              value={textOptionValues[handleMeasurementOptions['Side Handle Height'].id] ?? ''}
                              onChange={(e) => setTextOptionValues(prev => ({ ...prev, [handleMeasurementOptions['Side Handle Height']!.id]: e.target.value }))}
                            />
                          </Grid>
                        )}
                        {handleMeasurementOptions['Side Handle Top Edge to Center'] && (
                          <Grid item xs={3}>
                            <TextField
                              fullWidth
                              label="Top Edge → Center (in)"
                              value={textOptionValues[handleMeasurementOptions['Side Handle Top Edge to Center'].id] ?? ''}
                              onChange={(e) => setTextOptionValues(prev => ({ ...prev, [handleMeasurementOptions['Side Handle Top Edge to Center']!.id]: e.target.value }))}
                            />
                          </Grid>
                        )}
                        {handleMeasurementOptions['Side Handle Rear Edge to Center'] && (
                          <Grid item xs={3}>
                            <TextField
                              fullWidth
                              label="Rear Edge → Center (in)"
                              value={textOptionValues[handleMeasurementOptions['Side Handle Rear Edge to Center'].id] ?? ''}
                              onChange={(e) => setTextOptionValues(prev => ({ ...prev, [handleMeasurementOptions['Side Handle Rear Edge to Center']!.id]: e.target.value }))}
                            />
                          </Grid>
                        )}
                      </>
                    )}

                    {/* STEP 3: Angle Type - Show after Handle Location selected */}
                    <Grid item xs={12} sx={{ mt: 2 }}>
                      <FormControl fullWidth disabled={angleTypeOptions.length === 0}>
                        <InputLabel id="angle-type-label" shrink>Angle Type</InputLabel>
                        <Select
                          labelId="angle-type-label"
                          id="angle-type-select"
                          value={formData.angle_type_option_id || ''}
                          label="Angle Type"
                          onChange={(e) => setFormData({ ...formData, angle_type_option_id: e.target.value ? Number(e.target.value) : null })}
                          displayEmpty
                          notched
                          renderValue={(selected) => {
                            if (!selected) {
                              return <span style={{ color: '#9e9e9e', fontStyle: 'italic' }}>Select Angle Type</span>;
                            }
                            const selectedOption = angleTypeOptions.find(opt => opt.id === selected);
                            return selectedOption?.name || '';
                          }}
                        >
                          {angleTypeOptions.map((opt) => (
                            <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {angleTypeOptions.length === 0 && (
                        <Box sx={{ ml: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            No angle options configured for this equipment type.
                          </Typography>
                          <Button
                            size="small"
                            sx={{ fontSize: '0.7rem', p: 0, minWidth: 'auto', textTransform: 'none' }}
                            onClick={() => navigate('/design-options')}
                          >
                            Configure
                          </Button>
                        </Box>
                      )}
                    </Grid>
                  </>
                )}

                {/* STEP 3: Angle Drop & Top Depth - Show ONLY if hasAngle */}
                {hasHandleLocation && hasAngle && (
                  <>
                    {angleDropOption && (
                      <Grid item xs={12} sx={{ mt: 1 }}>
                        <TextField
                          fullWidth
                          label="Angle Drop"
                          multiline
                          minRows={2}
                          value={textOptionValues[angleDropOption.id] || ''}
                          onChange={(e) => setTextOptionValues(prev => ({ ...prev, [angleDropOption.id]: e.target.value }))}
                          helperText="Design notes only (not used for pricing)."
                        />
                      </Grid>
                    )}
                    {topDepthOption && (
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Top Depth"
                          multiline
                          minRows={2}
                          value={textOptionValues[topDepthOption.id] || ''}
                          onChange={(e) => setTextOptionValues(prev => ({ ...prev, [topDepthOption.id]: e.target.value }))}
                          helperText="Design notes only (not used for pricing)."
                        />
                      </Grid>
                    )}
                  </>
                )}

                {/* Generic Text Options - Remaining fields */}
                {textOptions.map(option => (
                  <Grid item xs={12} key={option.id} sx={{ mt: 1 }}>
                    <TextField
                      fullWidth
                      label={option.name}
                      multiline
                      minRows={2}
                      value={textOptionValues[option.id] || ''}
                      onChange={(e) => setTextOptionValues(prev => ({ ...prev, [option.id]: e.target.value }))}
                      helperText="Design notes only (not used for pricing)."
                    />
                  </Grid>
                ))}

              </>
            )}

            {/* PART B: Universal Model Notes - Always visible */}
            <Grid item xs={12} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Model Notes"
                multiline
                minRows={3}
                value={formData.model_notes}
                onChange={(e) => setFormData({ ...formData, model_notes: e.target.value })}
                helperText="General notes for this model (fabrication, handling, or special considerations)."
              />
            </Grid>

            {/* Export Exclusions Section */}
            <Grid item xs={12} sx={{ mt: 3, mb: 1 }}>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>Export Exclusions</Typography>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />
            </Grid>
            <Grid item xs={12}>
              <FormGroup row>
                <FormControlLabel
                  control={<Checkbox checked={formData.exclude_from_amazon_export} onChange={(e) => setFormData({ ...formData, exclude_from_amazon_export: e.target.checked })} />}
                  label="Exclude Amazon"
                />
                <FormControlLabel
                  control={<Checkbox checked={formData.exclude_from_ebay_export} onChange={(e) => setFormData({ ...formData, exclude_from_ebay_export: e.target.checked })} />}
                  label="Exclude eBay"
                />
                <FormControlLabel
                  control={<Checkbox checked={formData.exclude_from_reverb_export} onChange={(e) => setFormData({ ...formData, exclude_from_reverb_export: e.target.checked })} />}
                  label="Exclude Reverb"
                />
                <FormControlLabel
                  control={<Checkbox checked={formData.exclude_from_etsy_export} onChange={(e) => setFormData({ ...formData, exclude_from_etsy_export: e.target.checked })} />}
                  label="Exclude Etsy"
                />
              </FormGroup>
            </Grid>

            {/* Amazon A+ Content Section */}
            <Grid item xs={12} sx={{ mt: 3, mb: 1 }}>
              <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>Amazon A+ Content</Typography>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }} />
            </Grid>

            {/* Brand Story */}
            <Grid item xs={12} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.aplus_brand_story_uploaded}
                    onChange={(e) => setFormData({ ...formData, aplus_brand_story_uploaded: e.target.checked })}
                  />
                }
                label="Brand Story"
              />
            </Grid>
            <Grid item xs={12} md={9}>
              <TextField
                fullWidth
                size="small"
                label="Brand Story Notes / Version"
                value={formData.aplus_brand_story_notes}
                onChange={(e) => setFormData({ ...formData, aplus_brand_story_notes: e.target.value })}
                disabled={!formData.aplus_brand_story_uploaded}
              />
            </Grid>

            {/* EBC */}
            <Grid item xs={12} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.aplus_ebc_uploaded}
                    onChange={(e) => setFormData({ ...formData, aplus_ebc_uploaded: e.target.checked })}
                  />
                }
                label="EBC (Enhanced Brand Content)"
              />
            </Grid>
            <Grid item xs={12} md={9}>
              <TextField
                fullWidth
                size="small"
                label="EBC Notes / Version"
                value={formData.aplus_ebc_notes}
                onChange={(e) => setFormData({ ...formData, aplus_ebc_notes: e.target.value })}
                disabled={!formData.aplus_ebc_uploaded}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!isFormValid || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
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

      {/* BULK EDIT DIALOG */}
      <Dialog open={bulkEditOpen} onClose={() => setBulkEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Edit ({selectedModelIds.size} models)</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Amazon ASIN */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Checkbox
                  checked={bulkEditState.amazonAsin.enabled}
                  onChange={(e) => setBulkEditState(prev => ({ ...prev, amazonAsin: { ...prev.amazonAsin, enabled: e.target.checked } }))}
                />
                <Typography variant="subtitle1" fontWeight="bold">Amazon ASIN</Typography>
              </Box>
              {bulkEditState.amazonAsin.enabled && (
                <Grid container spacing={2} sx={{ pl: 5 }}>
                  <Grid item xs={12}>
                    <ToggleButtonGroup
                      value={bulkEditState.amazonAsin.mode}
                      exclusive
                      onChange={(_, v) => v && setBulkEditState(prev => ({ ...prev, amazonAsin: { ...prev.amazonAsin, mode: v } }))}
                      size="small"
                      sx={{ mb: 2 }}
                    >
                      <ToggleButton value="set">Set</ToggleButton>
                      <ToggleButton value="clear">Clear</ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>
                  {bulkEditState.amazonAsin.mode === 'set' && (
                    <Grid item xs={12}>
                      <TextField
                        label="ASIN"
                        fullWidth size="small"
                        value={bulkEditState.amazonAsin.value}
                        onChange={(e) => setBulkEditState(prev => ({ ...prev, amazonAsin: { ...prev.amazonAsin, value: e.target.value } }))}
                      />
                    </Grid>
                  )}
                </Grid>
              )}
            </Paper>

            {/* Default Measurements */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Checkbox
                  checked={bulkEditState.measurements.enabled}
                  onChange={(e) => setBulkEditState(prev => ({ ...prev, measurements: { ...prev.measurements, enabled: e.target.checked } }))}
                />
                <Typography variant="subtitle1" fontWeight="bold">Default Measurements</Typography>
              </Box>
              {bulkEditState.measurements.enabled && (
                <Grid container spacing={2} sx={{ pl: 5 }}>
                  <Grid item xs={4}>
                    <TextField label="Width" type="number" fullWidth size="small"
                      value={bulkEditState.measurements.width}
                      onChange={(e) => setBulkEditState(prev => ({ ...prev, measurements: { ...prev.measurements, width: Number(e.target.value) } }))}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="Depth" type="number" fullWidth size="small"
                      value={bulkEditState.measurements.depth}
                      onChange={(e) => setBulkEditState(prev => ({ ...prev, measurements: { ...prev.measurements, depth: Number(e.target.value) } }))}
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField label="Height" type="number" fullWidth size="small"
                      value={bulkEditState.measurements.height}
                      onChange={(e) => setBulkEditState(prev => ({ ...prev, measurements: { ...prev.measurements, height: Number(e.target.value) } }))}
                    />
                  </Grid>
                </Grid>
              )}
            </Paper>

            {/* Model Notes */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Checkbox
                  checked={bulkEditState.notes.enabled}
                  onChange={(e) => setBulkEditState(prev => ({ ...prev, notes: { ...prev.notes, enabled: e.target.checked } }))}
                />
                <Typography variant="subtitle1" fontWeight="bold">Model Notes</Typography>
              </Box>
              {bulkEditState.notes.enabled && (
                <Grid container spacing={2} sx={{ pl: 5 }}>
                  <Grid item xs={12}>
                    <ToggleButtonGroup
                      value={bulkEditState.notes.mode}
                      exclusive
                      onChange={(_, v) => v && setBulkEditState(prev => ({ ...prev, notes: { ...prev.notes, mode: v } }))}
                      size="small"
                      sx={{ mb: 2 }}
                    >
                      <ToggleButton value="replace">Replace</ToggleButton>
                      <ToggleButton value="append">Append</ToggleButton>
                      <ToggleButton value="clear">Clear</ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>
                  {(bulkEditState.notes.mode === 'replace' || bulkEditState.notes.mode === 'append') && (
                    <Grid item xs={12}>
                      <TextField
                        label="Notes"
                        fullWidth multiline minRows={3}
                        value={bulkEditState.notes.value}
                        onChange={(e) => setBulkEditState(prev => ({ ...prev, notes: { ...prev.notes, value: e.target.value } }))}
                      />
                    </Grid>
                  )}
                </Grid>
              )}
            </Paper>

            {/* Export Exclusions */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Checkbox
                  checked={bulkEditState.exportExclusion.enabled}
                  onChange={(e) => setBulkEditState(prev => ({ ...prev, exportExclusion: { ...prev.exportExclusion, enabled: e.target.checked } }))}
                />
                <Typography variant="subtitle1" fontWeight="bold">Export Exclusions (Set Status)</Typography>
              </Box>
              {bulkEditState.exportExclusion.enabled && (
                <Grid container spacing={2} sx={{ pl: 5 }}>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={<Checkbox checked={bulkEditState.exportExclusion.exclude_amazon} onChange={(e) => setBulkEditState(prev => ({ ...prev, exportExclusion: { ...prev.exportExclusion, exclude_amazon: e.target.checked } }))} />}
                      label="Exclude Amazon"
                    />
                    <FormControlLabel
                      control={<Checkbox checked={bulkEditState.exportExclusion.exclude_ebay} onChange={(e) => setBulkEditState(prev => ({ ...prev, exportExclusion: { ...prev.exportExclusion, exclude_ebay: e.target.checked } }))} />}
                      label="Exclude eBay"
                    />
                    <FormControlLabel
                      control={<Checkbox checked={bulkEditState.exportExclusion.exclude_reverb} onChange={(e) => setBulkEditState(prev => ({ ...prev, exportExclusion: { ...prev.exportExclusion, exclude_reverb: e.target.checked } }))} />}
                      label="Exclude Reverb"
                    />
                    <FormControlLabel
                      control={<Checkbox checked={bulkEditState.exportExclusion.exclude_etsy} onChange={(e) => setBulkEditState(prev => ({ ...prev, exportExclusion: { ...prev.exportExclusion, exclude_etsy: e.target.checked } }))} />}
                      label="Exclude Etsy"
                    />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      Note: Checked = Set to 'True' (Excluded). Unchecked = Set to 'False' (Included).
                    </Typography>
                  </Grid>
                </Grid>
              )}
            </Paper>

          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkEditOpen(false)} disabled={bulkEditApplying}>Cancel</Button>
          <Button onClick={handleBulkApply} variant="contained" disabled={bulkEditApplying}>
            {bulkEditApplying ? 'Applying...' : `Apply to ${selectedModelIds.size} Models`}
          </Button>
        </DialogActions>
      </Dialog>

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
