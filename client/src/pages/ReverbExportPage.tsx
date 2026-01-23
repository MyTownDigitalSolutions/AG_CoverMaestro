import { useEffect, useState, useMemo } from 'react'
import {
    Box, Typography, Paper, Button, Grid, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import DownloadIcon from '@mui/icons-material/Download'
import { manufacturersApi, seriesApi, modelsApi, pricingApi, exportApi } from '../services/api'
import type { Manufacturer, Series, Model } from '../types'

// Sentinel value for "All Series"
const ALL_SERIES_VALUE = '__ALL_SERIES__'

export default function ReverbExportPage() {
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
    const [allSeries, setAllSeries] = useState<Series[]>([])
    const [allModels, setAllModels] = useState<Model[]>([])

    const [selectedManufacturer, setSelectedManufacturer] = useState<number | ''>('')
    const [selectedSeries, setSelectedSeries] = useState<number | ''>('')
    const [selectedSeriesValue, setSelectedSeriesValue] = useState<string>(ALL_SERIES_VALUE)
    const [selectedModels, setSelectedModels] = useState<Set<number>>(new Set())

    const [loading, setLoading] = useState(true)
    const [recalculating, setRecalculating] = useState(false)
    const [downloading, setDownloading] = useState(false)
    const [fsStatus, setFsStatus] = useState<string | null>(null)
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
            setManufacturers(mfrs.sort((a, b) => a.name.localeCompare(b.name)))
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
        return allSeries
            .filter(s => s.manufacturer_id === selectedManufacturer)
            .sort((a, b) => a.name.localeCompare(b.name))
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

    const handleReverbExport = async () => {
        try {
            setDownloading(true)
            const modelIds = Array.from(selectedModels)
            console.log("[EXPORT][REVERB] Starting download")

            const response = await exportApi.downloadReverbCsv(modelIds, 'individual')

            let filename = "Reverb_Export.csv"
            const disposition = response.headers['content-disposition']
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
                const matches = filenameRegex.exec(disposition)
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '')
                }
            }

            const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', filename)
            document.body.appendChild(link)
            link.click()

            setTimeout(() => {
                link.parentNode?.removeChild(link)
                window.URL.revokeObjectURL(url)
            }, 100)

            setFsStatus("Reverb CSV Download started.")
            setTimeout(() => setFsStatus(null), 3000)

        } catch (e: any) {
            console.error("[EXPORT][REVERB] download failed", e)
            const detail = e.response?.data?.detail || e.message || "Unknown error"
            setError(`Reverb Download failed: ${detail}`)
        } finally {
            setDownloading(false)
        }
    }

    const handleSelectModel = (modelId: number, checked: boolean) => {
        const newSelected = new Set(selectedModels)
        if (checked) {
            newSelected.add(modelId)
        } else {
            newSelected.delete(modelId)
        }
        setSelectedModels(newSelected)
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedModels(new Set(filteredModels.map(m => m.id)))
        } else {
            setSelectedModels(new Set())
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
            <Typography variant="h4" gutterBottom>Reverb Export</Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
                Select models to prepare for Reverb export. Export functionality coming soon.
            </Typography>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {fsStatus && <Alert severity="info" sx={{ mt: 2 }}>{fsStatus}</Alert>}

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

            <Paper sx={{ width: '100%', mb: 2 }}>
                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={selectedModels.size > 0 && selectedModels.size < filteredModels.length}
                                        checked={filteredModels.length > 0 && selectedModels.size === filteredModels.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        disabled={filteredModels.length === 0}
                                    />
                                </TableCell>
                                <TableCell>Model Name</TableCell>
                                <TableCell>Series</TableCell>
                                <TableCell>Dimensions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredModels.map((row) => {
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
                                    >
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={(e) => handleSelectModel(row.id, e.target.checked)}
                                            />
                                        </TableCell>
                                        <TableCell component="th" scope="row">
                                            {row.name}
                                        </TableCell>
                                        <TableCell>{seriesName}</TableCell>
                                        <TableCell>{`${row.width}" x ${row.depth}" x ${row.height}"`}</TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredModels.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} align="center">
                                        <Typography sx={{ py: 2 }} color="text.secondary">
                                            No models found. Select a manufacturer to view models.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>Export Actions</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        color="secondary"
                        size="large"
                        startIcon={downloading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                        onClick={handleReverbExport}
                        disabled={selectedModels.size === 0 || downloading}
                    >
                        {downloading ? 'Downloading...' : 'Download Reverb CSV'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    )
}
