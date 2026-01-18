import { useEffect, useState, useMemo } from 'react'
import {
    Box, Typography, Paper, Button, Grid, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { manufacturersApi, seriesApi, modelsApi, pricingApi, materialsApi, designOptionsApi, settingsApi, ebayVariationsApi, type GenerateVariationsResponse, type VariationRow } from '../services/api'
import type { Manufacturer, Series, Model, Material, MaterialColourSurcharge, DesignOption, MaterialRoleAssignment, PricingOption } from '../types'

// Sentinel value for "All Series"
const ALL_SERIES_VALUE = '__ALL_SERIES__'

export default function EbayExportPage() {
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
    const [allSeries, setAllSeries] = useState<Series[]>([])
    const [allModels, setAllModels] = useState<Model[]>([])

    const [selectedManufacturer, setSelectedManufacturer] = useState<number | ''>('')
    const [selectedSeries, setSelectedSeries] = useState<number | ''>('')
    const [selectedSeriesValue, setSelectedSeriesValue] = useState<string>(ALL_SERIES_VALUE)
    const [selectedModels, setSelectedModels] = useState<Set<number>>(new Set())

    const [loading, setLoading] = useState(true)
    const [recalculating, setRecalculating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Variation inputs state
    const [materials, setMaterials] = useState<Material[]>([])
    const [designOptions, setDesignOptions] = useState<DesignOption[]>([])
    const [selectedMaterialId, setSelectedMaterialId] = useState<number | ''>('')
    const [selectedMaterialColourSurchargeId, setSelectedMaterialColourSurchargeId] = useState<number | ''>('')
    const [selectedDesignOptionIds, setSelectedDesignOptionIds] = useState<number[]>([])
    const [materialSurcharges, setMaterialSurcharges] = useState<MaterialColourSurcharge[]>([])
    const [materialRoles, setMaterialRoles] = useState<MaterialRoleAssignment[]>([])
    const [pricingOptions, setPricingOptions] = useState<PricingOption[]>([])
    const [selectedPricingOptionIds, setSelectedPricingOptionIds] = useState<number[]>([])

    // Variation generation state
    const [generatingVariations, setGeneratingVariations] = useState(false)
    const [variationError, setVariationError] = useState<string | null>(null)
    const [variationResult, setVariationResult] = useState<GenerateVariationsResponse | null>(null)

    // Load initial data
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [mfrs, series, models, mats, opts, roles, prices] = await Promise.all([
                manufacturersApi.list(),
                seriesApi.list(),
                modelsApi.list(),
                materialsApi.list(),
                designOptionsApi.list(),
                settingsApi.listMaterialRoles(false), // Get active roles only
                pricingApi.listOptions()
            ])
            setManufacturers(mfrs)
            setAllSeries(series)
            setAllModels(models)
            setMaterials(mats)
            setDesignOptions(opts)
            setMaterialRoles(roles)
            setPricingOptions(prices)
        } catch (err: any) {
            setError(err.message || 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    // Auto-select all models when "All Series" is selected
    useEffect(() => {
        if (selectedSeriesValue === ALL_SERIES_VALUE && selectedManufacturer && allModels.length > 0) {
            const manufacturerModels = allModels.filter(m => {
                const series = allSeries.find(s => s.id === m.series_id)
                return series?.manufacturer_id === selectedManufacturer
            })
            setSelectedModels(new Set(manufacturerModels.map(m => m.id)))
        }
    }, [selectedSeriesValue, selectedManufacturer, allModels, allSeries])

    // Filtered series based on manufacturer
    const filteredSeries = useMemo(() => {
        if (!selectedManufacturer) return []
        return allSeries.filter(s => s.manufacturer_id === selectedManufacturer)
    }, [selectedManufacturer, allSeries])

    // Filtered models based on manufacturer and series
    const filteredModels = useMemo(() => {
        let models = allModels

        if (selectedManufacturer) {
            const manufacturerSeriesIds = allSeries
                .filter(s => s.manufacturer_id === selectedManufacturer)
                .map(s => s.id)
            models = models.filter(m => manufacturerSeriesIds.includes(m.series_id))
        }

        if (selectedSeries) {
            models = models.filter(m => m.series_id === selectedSeries)
        }

        return models
    }, [selectedManufacturer, selectedSeries, allModels, allSeries])

    // Handle recalculate prices
    const handleRecalcPrices = async () => {
        if (selectedModels.size === 0) {
            alert('No models selected')
            return
        }

        try {
            setRecalculating(true)
            await pricingApi.recalculateBaselines({
                model_ids: Array.from(selectedModels),
                only_if_stale: false
            })
            alert('Pricing recalculated successfully')
        } catch (err: any) {
            alert(`Recalculation failed: ${err.message}`)
        } finally {
            setRecalculating(false)
        }
    }

    // Load material surcharges when material is selected
    useEffect(() => {
        const loadSurcharges = async () => {
            if (selectedMaterialId && typeof selectedMaterialId === 'number') {
                try {
                    const surcharges = await materialsApi.listSurcharges(selectedMaterialId)
                    setMaterialSurcharges(surcharges)
                } catch (err) {
                    console.error('Failed to load surcharges:', err)
                    setMaterialSurcharges([])
                }
            } else {
                setMaterialSurcharges([])
            }
        }
        loadSurcharges()
    }, [selectedMaterialId])

    // Filtered materials (only eBay variation enabled)
    const ebayMaterials = useMemo(() => {
        return materials.filter(m => m.ebay_variation_enabled)
    }, [materials])

    // Filtered surcharges (only eBay variation enabled)
    const ebayColorSurcharges = useMemo(() => {
        return materialSurcharges.filter(s => s.ebay_variation_enabled)
    }, [materialSurcharges])

    // Filtered design options (only pricing relevant AND eBay variation enabled)
    const ebayDesignOptions = useMemo(() => {
        return designOptions
            .filter(opt => opt.is_pricing_relevant && opt.ebay_variation_enabled)
            .sort((a, b) => a.id - b.id) // Deterministic ordering by id
    }, [designOptions])

    // Filtered pricing options (only eBay variation enabled)
    const ebayPricingOptions = useMemo(() => {
        return pricingOptions
            .filter(opt => opt.ebay_variation_enabled)
            .sort((a, b) => a.id - b.id) // Deterministic ordering by id
    }, [pricingOptions])

    // Handle material change - reset color selection
    const handleMaterialChange = (materialId: number | '') => {
        setSelectedMaterialId(materialId)
        setSelectedMaterialColourSurchargeId('') // Reset color when material changes
    }

    // Handle generate variations button
    const handleGenerateVariations = async () => {
        setVariationError(null)
        setVariationResult(null)
        setGeneratingVariations(true)

        try {
            const payload = {
                model_ids: Array.from(selectedModels),
                material_id: selectedMaterialId || 0,
                material_colour_surcharge_id: selectedMaterialColourSurchargeId || null,
                design_option_ids: selectedDesignOptionIds,
                pricing_option_ids: selectedPricingOptionIds
            }

            const result = await ebayVariationsApi.generate(payload)
            setVariationResult(result)
        } catch (err: any) {
            const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate variations'
            setVariationError(errorMessage)
        } finally {
            setGeneratingVariations(false)
        }
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>eBay Export</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                Select models to prepare for eBay export. Export functionality coming soon.
            </Typography>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>Filter Models</Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Manufacturer</InputLabel>
                            <Select
                                value={selectedManufacturer}
                                label="Manufacturer"
                                onChange={(e) => {
                                    setSelectedManufacturer(e.target.value as number | '')
                                    setSelectedSeries('')
                                    setSelectedSeriesValue(ALL_SERIES_VALUE)
                                    setSelectedModels(new Set())
                                }}
                            >
                                <MenuItem value="">All Manufacturers</MenuItem>
                                {manufacturers.map(m => (
                                    <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Series</InputLabel>
                            <Select
                                value={selectedSeriesValue}
                                label="Series"
                                onChange={(e) => {
                                    const newValue = e.target.value
                                    setSelectedSeriesValue(newValue)

                                    if (newValue === ALL_SERIES_VALUE) {
                                        setSelectedSeries('')
                                        const manufacturerModels = allModels.filter(m => {
                                            const series = allSeries.find(s => s.id === m.series_id)
                                            return series?.manufacturer_id === selectedManufacturer
                                        })
                                        setSelectedModels(new Set(manufacturerModels.map(m => m.id)))
                                    } else {
                                        const newSeriesId = Number(newValue)
                                        setSelectedSeries(newSeriesId)
                                        const modelsInSeries = allModels.filter(m => m.series_id === newSeriesId)
                                        setSelectedModels(new Set(modelsInSeries.map(m => m.id)))
                                    }
                                }}
                                disabled={!selectedManufacturer}
                            >
                                <MenuItem value={ALL_SERIES_VALUE}>All Series</MenuItem>
                                {filteredSeries.map(s => (
                                    <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {selectedModels.size} models selected
                        </Typography>
                    </Grid>
                </Grid>

                <Button
                    variant="contained"
                    startIcon={recalculating ? <CircularProgress size={20} /> : <RefreshIcon />}
                    onClick={handleRecalcPrices}
                    disabled={selectedModels.size === 0 || recalculating}
                >
                    {recalculating ? 'Recalculating...' : 'Recalc Prices'}
                </Button>
            </Paper>

            {/* Variation Inputs Section */}
            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>Variation Inputs</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    Select material, color, and design options for eBay variation SKU generation.
                </Typography>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Material</InputLabel>
                            <Select
                                value={selectedMaterialId}
                                label="Material"
                                onChange={(e) => handleMaterialChange(e.target.value as number | '')}
                            >
                                <MenuItem value="">None</MenuItem>
                                {ebayMaterials.map(m => (
                                    <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Color</InputLabel>
                            <Select
                                value={selectedMaterialColourSurchargeId}
                                label="Color"
                                onChange={(e) => setSelectedMaterialColourSurchargeId(e.target.value as number | '')}
                                disabled={!selectedMaterialId}
                            >
                                <MenuItem value="">None</MenuItem>
                                {ebayColorSurcharges.map(s => (
                                    <MenuItem key={s.id} value={s.id}>
                                        {s.color_friendly_name || s.colour} (${s.surcharge.toFixed(2)})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Design Options</InputLabel>
                            <Select
                                multiple
                                value={selectedDesignOptionIds}
                                label="Design Options"
                                onChange={(e) => {
                                    const value = e.target.value
                                    setSelectedDesignOptionIds(typeof value === 'string' ? [] : value as number[])
                                }}
                            >
                                {ebayDesignOptions.map(opt => (
                                    <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Pricing Options</InputLabel>
                            <Select
                                multiple
                                value={selectedPricingOptionIds}
                                label="Pricing Options"
                                onChange={(e) => {
                                    const value = e.target.value
                                    setSelectedPricingOptionIds(typeof value === 'string' ? [] : value as number[])
                                }}
                            >
                                {ebayPricingOptions.map(opt => (
                                    <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>

                <Box sx={{ mt: 3 }}>
                    <Button
                        variant="contained"
                        onClick={handleGenerateVariations}
                        disabled={selectedModels.size === 0 || !selectedMaterialId || generatingVariations}
                    >
                        {generatingVariations ? 'Generating...' : 'Generate Variations'}
                    </Button>
                </Box>

                {/* Error Display */}
                {variationError && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                        {variationError}
                    </Alert>
                )}

                {/* Variation Preview Table */}
                {variationResult && variationResult.rows.length > 0 && (
                    <Paper sx={{ mt: 3, p: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Generated Variations ({variationResult.created} created, {variationResult.updated} updated)
                        </Typography>
                        <Box sx={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Model ID</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>SKU</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Material</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Color</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Design Options</th>
                                        <th style={{ textAlign: 'left', padding: '8px' }}>Pricing Options</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {variationResult.rows.map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '8px' }}>{row.model_id}</td>
                                            <td style={{ padding: '8px', fontFamily: 'monospace' }}>{row.sku}</td>
                                            <td style={{ padding: '8px' }}>{row.material_id}</td>
                                            <td style={{ padding: '8px' }}>{row.material_colour_surcharge_id || '-'}</td>
                                            <td style={{ padding: '8px' }}>{row.design_option_ids.join(', ') || '-'}</td>
                                            <td style={{ padding: '8px' }}>{row.pricing_option_ids.join(', ') || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Box>
                    </Paper>
                )}

                {/* Selected Variation Summary (Read-Only) */}
                {selectedMaterialId && (
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="subtitle2" gutterBottom>
                            Selected Variation Summary (Read-Only)
                        </Typography>

                        {/* Active Role Assignments */}
                        <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                                Active Role Assignment(s):
                            </Typography>
                            {materialRoles.filter(r => r.material_id === selectedMaterialId && (!r.end_date || new Date(r.end_date) > new Date())).length > 0 ? (
                                materialRoles
                                    .filter(r => r.material_id === selectedMaterialId && (!r.end_date || new Date(r.end_date) > new Date()))
                                    .map(role => (
                                        <Typography key={role.id} variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                            • {role.role} (effective {new Date(role.effective_date).toLocaleDateString()})
                                        </Typography>
                                    ))
                            ) : (
                                <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                    No active roles
                                </Typography>
                            )}
                        </Box>

                        {/* SKU Abbreviations */}
                        <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                                Material SKU Abbreviation:
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                {(() => {
                                    const mat = materials.find(m => m.id === selectedMaterialId)
                                    const abbrev = mat?.sku_abbreviation
                                    return abbrev && abbrev.length === 3 ? abbrev : '(missing)'
                                })()}
                            </Typography>
                        </Box>

                        {selectedMaterialColourSurchargeId && (
                            <Box sx={{ mb: 1 }}>
                                <Typography variant="body2" fontWeight="bold">
                                    Color SKU Abbreviation:
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                    {(() => {
                                        const surcharge = materialSurcharges.find(s => s.id === selectedMaterialColourSurchargeId)
                                        const abbrev = surcharge?.sku_abbreviation
                                        return abbrev && abbrev.length === 3 ? abbrev : '(missing)'
                                    })()}
                                </Typography>
                            </Box>
                        )}

                        {selectedDesignOptionIds.length > 0 && (
                            <Box>
                                <Typography variant="body2" fontWeight="bold">
                                    Design Option SKU Abbreviations:
                                </Typography>
                                {selectedDesignOptionIds
                                    .map(id => designOptions.find(opt => opt.id === id))
                                    .filter(Boolean)
                                    .sort((a, b) => (a?.id || 0) - (b?.id || 0))
                                    .map(opt => {
                                        const abbrev = opt?.sku_abbreviation
                                        return (
                                            <Typography key={opt?.id} variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                                • {opt?.name}: {abbrev && abbrev.length === 3 ? abbrev : '(missing)'}
                                            </Typography>
                                        )
                                    })}
                            </Box>
                        )}

                        {selectedPricingOptionIds.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" fontWeight="bold">
                                    Pricing Option SKU Abbreviations:
                                </Typography>
                                {selectedPricingOptionIds
                                    .map(id => pricingOptions.find(opt => opt.id === id))
                                    .filter(Boolean)
                                    .sort((a, b) => (a?.id || 0) - (b?.id || 0))
                                    .map(opt => {
                                        const abbrev = opt?.sku_abbreviation
                                        return (
                                            <Typography key={opt?.id} variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                                • {opt?.name}: {abbrev && abbrev.length === 3 ? abbrev : '(missing)'}
                                            </Typography>
                                        )
                                    })}
                            </Box>
                        )}
                    </Box>
                )}
            </Paper>
        </Box>
    )
}
