import { useEffect, useState, useMemo } from 'react'
import {
    Box, Typography, Paper, Button, Grid, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert, Chip,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import { manufacturersApi, seriesApi, modelsApi, pricingApi } from '../services/api'
import type { Manufacturer, Series, Model } from '../types'

// Sentinel value for "All Series"
const ALL_SERIES_VALUE = '__ALL_SERIES__'
// Sentinel value for "Multi Series" mode (internal state usage)
const MULTI_SERIES_VALUE = '__MULTI__'

export default function EtsyExportPage() {
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
    const [allSeries, setAllSeries] = useState<Series[]>([])
    const [allModels, setAllModels] = useState<Model[]>([])

    const [selectedManufacturer, setSelectedManufacturer] = useState<number | ''>('')
    // selectedSeries (single) is deprecated for filtering, using multi-select ids instead
    const [selectedSeriesValue, setSelectedSeriesValue] = useState<string>(ALL_SERIES_VALUE)
    const [selectedSeriesIds, setSelectedSeriesIds] = useState<number[]>([])
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

    // Sorted Manufacturers
    const sortedManufacturers = useMemo(() => {
        return [...manufacturers].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
        )
    }, [manufacturers])

    // Filtered and Sorted Series based on manufacturer
    const sortedFilteredSeries = useMemo(() => {
        if (!selectedManufacturer) return []
        return allSeries
            .filter(s => s.manufacturer_id === selectedManufacturer)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    }, [selectedManufacturer, allSeries])

    // Filtered models based on manufacturer and series selection
    const filteredModels = useMemo(() => {
        if (!selectedManufacturer) return []

        let models = allModels

        // Filter by manufacturer objects first
        const manufacturerSeriesIds = allSeries
            .filter(s => s.manufacturer_id === selectedManufacturer)
            .map(s => s.id)
        models = models.filter(m => manufacturerSeriesIds.includes(m.series_id))

        // Filter by series selection
        if (selectedSeriesValue !== ALL_SERIES_VALUE && selectedSeriesIds.length > 0) {
            models = models.filter(m => selectedSeriesIds.includes(m.series_id))
        }

        return models
    }, [selectedManufacturer, selectedSeriesValue, selectedSeriesIds, allModels, allSeries])

    // Auto-select all models when filtered list changes
    useEffect(() => {
        if (!selectedManufacturer) {
            setSelectedModels(new Set())
            return
        }

        if (filteredModels.length > 0) {
            setSelectedModels(new Set(filteredModels.map(m => m.id)))
        } else {
            setSelectedModels(new Set())
        }
    }, [filteredModels, selectedManufacturer])

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
                                    // Reset series state
                                    setSelectedSeriesValue(ALL_SERIES_VALUE)
                                    setSelectedSeriesIds([])
                                    setSelectedModels(new Set())
                                }}
                            >
                                <MenuItem value="">All Manufacturers</MenuItem>
                                {sortedManufacturers.map(m => (
                                    <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Series</InputLabel>
                            <Select
                                multiple
                                value={selectedSeriesValue === ALL_SERIES_VALUE ? [ALL_SERIES_VALUE] : selectedSeriesIds.map(String)}
                                label="Series"
                                onChange={(e) => {
                                    const valuev = e.target.value
                                    // Handle array return from multiple select
                                    const values = typeof valuev === 'string' ? valuev.split(',') : valuev as string[]

                                    // Check if "All Series" was just selected (it will be the last element if recently clicked while others were selected)
                                    const lastSelected = values[values.length - 1]

                                    if (lastSelected === ALL_SERIES_VALUE) {
                                        setSelectedSeriesValue(ALL_SERIES_VALUE)
                                        setSelectedSeriesIds([])
                                        return
                                    }

                                    // Filter out ALL_SERIES_VALUE if mixed with others
                                    const validIds = values
                                        .filter(v => v !== ALL_SERIES_VALUE)
                                        .map(v => Number(v))

                                    if (validIds.length === 0) {
                                        // Revert to All Series if empty
                                        setSelectedSeriesValue(ALL_SERIES_VALUE)
                                        setSelectedSeriesIds([])
                                    } else {
                                        setSelectedSeriesValue(MULTI_SERIES_VALUE)
                                        setSelectedSeriesIds(validIds)
                                    }
                                }}
                                disabled={!selectedManufacturer}
                                renderValue={(selected) => {
                                    if (selected.includes(ALL_SERIES_VALUE)) {
                                        return (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                <Chip label="All Series" size="small" />
                                            </Box>
                                        )
                                    }
                                    return (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.map((idStr) => {
                                                const s = allSeries.find(ser => ser.id === Number(idStr))
                                                return <Chip key={idStr} label={s?.name || idStr} size="small" />
                                            })}
                                        </Box>
                                    )
                                }}
                            >
                                <MenuItem value={ALL_SERIES_VALUE}>All Series</MenuItem>
                                {sortedFilteredSeries.map(s => (
                                    <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            {selectedManufacturer ? `${selectedModels.size} models selected` : '0 models selected'}
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

            <Paper sx={{ width: '100%', mb: 2, mt: 3, p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Models</Typography>
                    {selectedManufacturer && (
                        <Typography variant="body2" color="text.secondary">
                            Showing {filteredModels.length} models • {selectedModels.size} selected
                        </Typography>
                    )}
                </Box>

                {!selectedManufacturer ? (
                    <Alert severity="info">Select a manufacturer to view models.</Alert>
                ) : (
                    <TableContainer sx={{ maxHeight: 600 }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            indeterminate={selectedModels.size > 0 && selectedModels.size < filteredModels.length}
                                            checked={filteredModels.length > 0 && selectedModels.size === filteredModels.length}
                                            onChange={() => {
                                                if (selectedModels.size === filteredModels.length && filteredModels.length > 0) {
                                                    setSelectedModels(new Set())
                                                } else {
                                                    setSelectedModels(new Set(filteredModels.map(m => m.id)))
                                                }
                                            }}
                                            disabled={filteredModels.length === 0}
                                        />
                                    </TableCell>
                                    <TableCell>Model Name</TableCell>
                                    <TableCell>Series</TableCell>
                                    <TableCell>Dimensions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredModels.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                No models found matching the filters.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredModels.map((row) => {
                                        const isSelected = selectedModels.has(row.id);
                                        const seriesName = allSeries.find(s => s.id === row.series_id)?.name || 'Unknown';
                                        return (
                                            <TableRow
                                                hover
                                                role="checkbox"
                                                aria-checked={isSelected}
                                                tabIndex={-1}
                                                key={row.id}
                                                selected={isSelected}
                                                onClick={(e) => {
                                                    const newSelected = new Set(selectedModels)
                                                    if (newSelected.has(row.id)) {
                                                        newSelected.delete(row.id)
                                                    } else {
                                                        newSelected.add(row.id)
                                                    }
                                                    setSelectedModels(newSelected)
                                                }}
                                                sx={{ cursor: 'pointer' }}
                                            >
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            e.stopPropagation()
                                                            const newSelected = new Set(selectedModels)
                                                            if (newSelected.has(row.id)) {
                                                                newSelected.delete(row.id)
                                                            } else {
                                                                newSelected.add(row.id)
                                                            }
                                                            setSelectedModels(newSelected)
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell component="th" scope="row">
                                                    {row.name}
                                                </TableCell>
                                                <TableCell>{seriesName}</TableCell>
                                                <TableCell>{`${row.width || '-'} " x ${row.depth || '-'} " x ${row.height || '-'} "`}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    )
}
