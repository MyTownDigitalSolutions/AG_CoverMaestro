import { useState, useEffect, useMemo } from 'react'
import {
    Box, Typography, Paper, Grid, TextField, Button,
    FormControl, FormLabel, RadioGroup, FormControlLabel, Radio,
    MenuItem, Select, Snackbar, Alert, CircularProgress,
    InputAdornment, Checkbox, Divider, InputLabel
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import WarningIcon from '@mui/icons-material/Warning'
import RefreshIcon from '@mui/icons-material/Refresh'
import ClearIcon from '@mui/icons-material/Clear'
import { settingsApi, pricingApi } from '../services/api'
import { ShippingDefaultSettingResponse, ShippingZone, ShippingRateCard, ShippingRateTier, ShippingZoneRateNormalized } from '../types'

export default function ShippingDefaultsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [recalculating, setRecalculating] = useState(false)
    const [forceRecalc, setForceRecalc] = useState(false)
    const [zones, setZones] = useState<ShippingZone[]>([])

    const [defaults, setDefaults] = useState<ShippingDefaultSettingResponse>({
        id: 0,
        shipping_mode: 'calculated',
        flat_shipping_cents: 0,
        default_rate_card_id: null,
        default_zone_code: null,
        assumed_rate_card_id: null,
        assumed_tier_id: null,
        assumed_zone_code: null,
        shipping_settings_version: 0
    })

    // Assumed Shipping State
    const [rateCards, setRateCards] = useState<ShippingRateCard[]>([])
    const [tiers, setTiers] = useState<ShippingRateTier[]>([])
    const [tierZoneRates, setTierZoneRates] = useState<ShippingZoneRateNormalized[]>([])

    // For controlled input of dollar amount
    const [flatRateStr, setFlatRateStr] = useState("0.00")

    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [defaultsData, zonesData, cards] = await Promise.all([
                settingsApi.getShippingDefaults(),
                settingsApi.listZones(),
                settingsApi.listRateCards(false) // Active only
            ])

            setDefaults(defaultsData)
            setZones(zonesData)
            setRateCards(cards)
            setFlatRateStr((defaultsData.flat_shipping_cents / 100).toFixed(2))

            // Pre-load tiers and rates if assumed values exist
            if (defaultsData.assumed_rate_card_id) {
                const fetchedTiers = await settingsApi.listTiers(defaultsData.assumed_rate_card_id, false)
                setTiers(fetchedTiers)

                if (defaultsData.assumed_tier_id) {
                    const fetchedRates = await settingsApi.listZoneRates(defaultsData.assumed_tier_id)
                    setTierZoneRates(fetchedRates)
                }
            }

        } catch (err) {
            console.error(err)
            setMessage({ text: 'Failed to load settings', type: 'error' })
        } finally {
            setLoading(false)
        }
    }

    // -----------------------------
    // Helpers for zone dropdown pricing
    // -----------------------------
    const rateByZoneCode = useMemo(() => {
        const map = new Map<string, number | null>()
        for (const r of tierZoneRates) {
            map.set(String(r.zone_code), r.rate_cents ?? null)
        }
        return map
    }, [tierZoneRates])

    const formatDollars = (cents: number) => (cents / 100).toFixed(2)

    const selectedTier = useMemo(() => {
        if (!defaults.assumed_tier_id) return null
        return tiers.find(t => t.id === defaults.assumed_tier_id) ?? null
    }, [defaults.assumed_tier_id, tiers])

    const selectedTierCaption = useMemo(() => {
        if (!selectedTier) return null
        const label = (selectedTier.label && selectedTier.label.trim().length > 0)
            ? selectedTier.label.trim()
            : null
        // USPS-style "Weight Not Over"
        return label
            ? `${label} — Weight Not Over: ${selectedTier.max_oz} oz`
            : `Weight Not Over: ${selectedTier.max_oz} oz`
    }, [selectedTier])

    // Cascading dropdown handlers
    const handleAssumedCardChange = async (cardId: number | null) => {
        setDefaults(prev => ({
            ...prev,
            assumed_rate_card_id: cardId,
            assumed_tier_id: null,
            assumed_zone_code: null
        }))
        setTiers([])
        setTierZoneRates([])

        if (cardId) {
            try {
                const fetchedTiers = await settingsApi.listTiers(cardId, false)
                setTiers(fetchedTiers)
            } catch (err) {
                console.error("Failed to load tiers", err)
            }
        }
    }

    const handleAssumedTierChange = async (tierId: number | null) => {
        setDefaults(prev => ({
            ...prev,
            assumed_tier_id: tierId,
            // Optional: clear zone when tier changes to avoid stale zone selection
            assumed_zone_code: null
        }))
        setTierZoneRates([])

        if (tierId) {
            try {
                const fetchedRates = await settingsApi.listZoneRates(tierId)
                setTierZoneRates(fetchedRates)
            } catch (err) {
                console.error("Failed to load tier rates", err)
            }
        }
    }

    const getDerivedPrice = () => {
        if (!defaults.assumed_tier_id || !defaults.assumed_zone_code) return null

        const rate = tierZoneRates.find(r => r.zone_code === defaults.assumed_zone_code)
        const tier = tiers.find(t => t.id === defaults.assumed_tier_id)

        if (rate && rate.rate_cents !== null) {
            return (
                <Alert severity="success" sx={{ mt: 2 }}>
                    Derived cost from matrix: <strong>${(rate.rate_cents / 100).toFixed(2)}</strong>
                </Alert>
            )
        } else {
            return (
                <Alert severity="warning" sx={{ mt: 2 }}>
                    No rate set for Weight ≤ {tier?.max_oz} oz / Zone {defaults.assumed_zone_code}
                </Alert>
            )
        }
    }

    const handleClearAssumptions = () => {
        setDefaults(prev => ({
            ...prev,
            assumed_rate_card_id: null,
            assumed_tier_id: null,
            assumed_zone_code: null
        }))
        setTiers([])
        setTierZoneRates([])
    }

    const isAssumedValid = () => {
        const { assumed_rate_card_id, assumed_tier_id, assumed_zone_code } = defaults
        const count = [assumed_rate_card_id, assumed_tier_id, assumed_zone_code].filter(v => v !== null).length
        return count === 0 || count === 3
    }

    // Check if configuration is actively invalid
    // 1. If Fixed Cell mode, we MUST have assumed settings AND valid rate.
    const isConfigurationInvalid = () => {
        if (!isAssumedValid()) return "Incomplete assumed shipping settings (All or None)."

        if (defaults.shipping_mode === 'fixed_cell') {
            if (!defaults.assumed_rate_card_id || !defaults.assumed_tier_id || !defaults.assumed_zone_code) {
                return "Fixed Cell mode requires a full Assumed Shipping Assumption."
            }
            const rate = tierZoneRates.find(r => r.zone_code === defaults.assumed_zone_code)
            if (!rate || rate.rate_cents === null) return "Fixed Cell mode requires a valid rate in the Assumed Usage table."
        }

        return null
    }

    const handleSave = async () => {
        const error = isConfigurationInvalid()
        if (error) {
            setMessage({ text: error, type: 'error' })
            return
        }

        try {
            setSaving(true)

            const cents = Math.round(parseFloat(flatRateStr) * 100)

            const payload = {
                ...defaults,
                flat_shipping_cents: cents
            }

            const updated = await settingsApi.updateShippingDefaults(payload)
            setDefaults(updated)
            setFlatRateStr((updated.flat_shipping_cents / 100).toFixed(2))
            setMessage({
                text: `Saved. Version flushed to ${updated.shipping_settings_version}.`,
                type: 'success'
            })
        } catch (err: any) {
            console.error(err)
            setMessage({ text: err.response?.data?.detail || 'Failed to save settings', type: 'error' })
        } finally {
            setSaving(false)
        }
    }

    const handleRecalculateAll = async () => {
        try {
            setRecalculating(true)
            const res = await pricingApi.recalculateBaselines({
                all: true,
                only_if_stale: !forceRecalc
            })

            setMessage({
                text: `Evaluated ${res.evaluated_models} models. Recalculated ${res.recalculated_models}. Skipped ${res.skipped_not_stale} (not stale).`,
                type: 'info'
            })
        } catch (err) {
            console.error(err)
            setMessage({ text: 'Failed to trigger recalculation', type: 'error' })
        } finally {
            setRecalculating(false)
        }
    }

    if (loading) {
        return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Shipping Defaults
            </Typography>

            <Paper sx={{ p: 3, maxWidth: 800 }}>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2" color="text.secondary">
                                Current Settings Version: <strong>{defaults.shipping_settings_version}</strong>
                            </Typography>
                        </Box>

                        <FormControl component="fieldset">
                            <FormLabel component="legend">Shipping Calculation Mode</FormLabel>
                            <RadioGroup
                                row
                                value={defaults.shipping_mode}
                                onChange={(e) => setDefaults({ ...defaults, shipping_mode: e.target.value as 'calculated' | 'flat' | 'fixed_cell' })}
                            >
                                <FormControlLabel value="calculated" control={<Radio />} label="Calculated (Weight-based)" />
                                <FormControlLabel value="flat" control={<Radio />} label="Flat Rate (Global Override)" />
                                <FormControlLabel value="fixed_cell" control={<Radio />} label="Fixed Cell (Use Assumption)" />
                            </RadioGroup>
                        </FormControl>
                    </Grid>

                    {defaults.shipping_mode === 'flat' && (
                        <Grid item xs={12} md={6}>
                            <TextField
                                label="Flat Shipping Rate"
                                variant="outlined"
                                fullWidth
                                value={flatRateStr}
                                onChange={(e) => setFlatRateStr(e.target.value)}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                }}
                                helperText="This rate will override ALL calculated shipping costs."
                            />
                        </Grid>
                    )}

                    {defaults.shipping_mode === 'calculated' && (
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <FormLabel>Default Fallback Zone</FormLabel>
                                <Select
                                    value={defaults.default_zone_code || ''}
                                    onChange={(e) => setDefaults({ ...defaults, default_zone_code: (e.target.value as string) || null })}
                                    displayEmpty
                                >
                                    <MenuItem value="">
                                        <em>None (Error if profile zone missing)</em>
                                    </MenuItem>
                                    {zones.map((z) => (
                                        <MenuItem key={z.id} value={z.code}>
                                            {z.name} (Zone {z.code})
                                        </MenuItem>
                                    ))}
                                </Select>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    Used only if a Marketplace Profile has no specific pricing zone assigned.
                                </Typography>
                            </FormControl>
                        </Grid>
                    )}

                    <Grid item xs={12}>
                        <Divider sx={{ my: 2 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">
                                Default Shipping Assumption (USPS Table)
                            </Typography>
                            <Button
                                startIcon={<ClearIcon />}
                                onClick={handleClearAssumptions}
                                disabled={!defaults.assumed_rate_card_id}
                                size="small"
                            >
                                Clear
                            </Button>
                        </Box>

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth>
                                    <InputLabel>Assumed Rate Card</InputLabel>
                                    <Select
                                        label="Assumed Rate Card"
                                        value={defaults.assumed_rate_card_id || ''}
                                        onChange={(e) => handleAssumedCardChange(e.target.value === '' ? null : Number(e.target.value))}
                                    >
                                        <MenuItem value="">
                                            <em>None</em>
                                        </MenuItem>
                                        {rateCards.map(c => (
                                            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth disabled={!defaults.assumed_rate_card_id}>
                                    <InputLabel>Assumed Tier</InputLabel>
                                    <Select
                                        label="Assumed Tier"
                                        value={defaults.assumed_tier_id || ''}
                                        onChange={(e) => handleAssumedTierChange(e.target.value === '' ? null : Number(e.target.value))}
                                    >
                                        <MenuItem value="">
                                            <em>None</em>
                                        </MenuItem>
                                        {tiers.map(t => (
                                            <MenuItem key={t.id} value={t.id}>
                                                {t.label ? `${t.label} (≤ ${t.max_oz} oz)` : `Weight ≤ ${t.max_oz} oz`}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth disabled={!defaults.assumed_tier_id}>
                                    <InputLabel>Assumed Zone</InputLabel>

                                    {/* Tiny upgrade: show selected tier context right above zone dropdown */}
                                    {selectedTierCaption && (
                                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                                            {selectedTierCaption}
                                        </Typography>
                                    )}

                                    <Select
                                        label="Assumed Zone"
                                        value={defaults.assumed_zone_code || ''}
                                        onChange={(e) => setDefaults({ ...defaults, assumed_zone_code: (e.target.value as string) || null })}
                                        displayEmpty
                                        renderValue={(val) => {
                                            const v = String(val || '')
                                            if (!v) return 'None'
                                            const cents = rateByZoneCode.get(v) ?? null
                                            return cents != null
                                                ? `Zone ${v} — $${formatDollars(cents)}`
                                                : `Zone ${v} — Not set`
                                        }}
                                    >
                                        <MenuItem value="">
                                            <em>None</em>
                                        </MenuItem>

                                        {zones.map(z => {
                                            const cents = rateByZoneCode.get(z.code) ?? null
                                            const label = cents != null
                                                ? `${z.name} — $${formatDollars(cents)}`
                                                : `${z.name} — Not set`

                                            // Optional: prevent choosing a "Not set" zone when fixed_cell is active
                                            const disableIfMissing = defaults.shipping_mode === 'fixed_cell' && cents == null

                                            return (
                                                <MenuItem key={z.id} value={z.code} disabled={disableIfMissing}>
                                                    {label}
                                                </MenuItem>
                                            )
                                        })}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        {getDerivedPrice()}
                    </Grid>

                    <Grid item xs={12}>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disabled={saving || !!isConfigurationInvalid()}
                        >
                            {saving ? 'Saving...' : 'Save Configuration'}
                        </Button>
                    </Grid>

                    <Grid item xs={12}>
                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h6" gutterBottom>
                            Baselines Maintenance
                        </Typography>
                        <Alert severity="info" icon={<WarningIcon />} sx={{ mb: 2 }}>
                            Existing pricing snapshots may become stale when shipping defaults change.
                        </Alert>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Button
                                variant="outlined"
                                color="secondary"
                                startIcon={<RefreshIcon />}
                                onClick={handleRecalculateAll}
                                disabled={recalculating}
                            >
                                {recalculating ? 'Processing...' : 'Recalculate All Baselines'}
                            </Button>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={forceRecalc}
                                        onChange={(e) => setForceRecalc(e.target.checked)}
                                    />
                                }
                                label="Force recalculate even if not stale"
                            />
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            <Snackbar
                open={!!message}
                autoHideDuration={6000}
                onClose={() => setMessage(null)}
            >
                <Alert severity={message?.type as any} onClose={() => setMessage(null)}>
                    {message?.text}
                </Alert>
            </Snackbar>
        </Box>
    )
}
