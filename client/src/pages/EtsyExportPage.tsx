import { useEffect, useState, useMemo } from 'react'
import {
    Box, Typography, Paper, Button, Grid, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { manufacturersApi, seriesApi, modelsApi, pricingApi } from '../services/api'
import type { Manufacturer, Series, Model } from '../types'

// Sentinel value for "All Series"
const ALL_SERIES_VALUE = '__ALL_SERIES__'

export default function EtsyExportPage() {
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

    // Load initial data
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const [mfrs, series, models] = await Promise.all([
                manufacturersApi.list(),
                seriesApi.list(),
                modelsApi.list()
            ])
            setManufacturers(mfrs)
            setAllSeries(series)
            setAllModels(models)
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

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Etsy Export</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                Select models to prepare for Etsy export. Export functionality coming soon.
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
        </Box>
    )
}
