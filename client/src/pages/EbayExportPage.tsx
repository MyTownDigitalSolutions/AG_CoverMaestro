import { useEffect, useState, useMemo } from 'react'
import {
    Box, Typography, Paper, Button, Grid, FormControl, InputLabel, Select, MenuItem, CircularProgress, Alert, Chip,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, CheckboxProps
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
    manufacturersApi, seriesApi, modelsApi, pricingApi, materialsApi, designOptionsApi,
    settingsApi, ebayVariationsApi, equipmentTypesApi,
    type GenerateVariationsResponse, type VariationRow
} from '../services/api'
import type {
    Manufacturer, Series, Model, Material, MaterialColourSurcharge, DesignOption,
    MaterialRoleAssignment, MaterialRoleConfig, EquipmentType
} from '../types'

// Sentinel value for "All Series"
const ALL_SERIES_VALUE = '__ALL_SERIES__'
// Sentinel value for "Multi Series" mode (internal state usage)
const MULTI_SERIES_VALUE = '__MULTI__'

export default function EbayExportPage() {
    const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
    const [allSeries, setAllSeries] = useState<Series[]>([])
    const [allModels, setAllModels] = useState<Model[]>([])
    const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])

    const [selectedManufacturer, setSelectedManufacturer] = useState<number | ''>('')
    // selectedSeries (single) is deprecated for filtering, using multi-select ids instead
    const [selectedSeriesValue, setSelectedSeriesValue] = useState<string>(ALL_SERIES_VALUE)
    const [selectedSeriesIds, setSelectedSeriesIds] = useState<number[]>([])
    const [selectedModels, setSelectedModels] = useState<Set<number>>(new Set())

    const [loading, setLoading] = useState(true)
    const [recalculating, setRecalculating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Variation inputs state
    const [materials, setMaterials] = useState<Material[]>([])
    const [designOptions, setDesignOptions] = useState<DesignOption[]>([])
    const [selectedRoleKeys, setSelectedRoleKeys] = useState<string[]>([])
    const [selectedColourSurchargeIdsByRole, setSelectedColourSurchargeIdsByRole] = useState<Record<string, number[]>>({})
    const [selectedDesignOptionIds, setSelectedDesignOptionIds] = useState<number[]>([])
    const [materialRoles, setMaterialRoles] = useState<MaterialRoleAssignment[]>([])
    const [roleConfigs, setRoleConfigs] = useState<MaterialRoleConfig[]>([])

    // Variation generation state
    const [generatingVariations, setGeneratingVariations] = useState(false)
    const [variationError, setVariationError] = useState<string | null>(null)
    const [variationResult, setVariationResult] = useState<GenerateVariationsResponse | null>(null)

    // Existing variations viewer state
    const [loadingExisting, setLoadingExisting] = useState(false)
    const [existingVariations, setExistingVariations] = useState<VariationRow[]>([])

    // Load initial data
    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        try {
            setLoading(true)
            const results = await Promise.allSettled([
                manufacturersApi.list(),
                seriesApi.list(),
                modelsApi.list(),
                materialsApi.list(),
                designOptionsApi.list(),
                settingsApi.listMaterialRoles(false), // Get active roles only
                settingsApi.listMaterialRoleConfigs(),
                equipmentTypesApi.list()
            ])

            // Helper to safely extract results
            const getResult = <T>(index: number, defaultValue: T): T => {
                const res = results[index]
                if (res.status === 'fulfilled') {
                    return res.value as T
                }
                console.error(`Failed to load data at index ${index}:`, res.reason)
                return defaultValue
            }

            setManufacturers(getResult<Manufacturer[]>(0, []))
            setAllSeries(getResult<Series[]>(1, []))
            setAllModels(getResult<Model[]>(2, []))
            setMaterials(getResult<Material[]>(3, []))
            setDesignOptions(getResult<DesignOption[]>(4, []))
            setMaterialRoles(getResult<MaterialRoleAssignment[]>(5, []))
            setRoleConfigs(getResult<MaterialRoleConfig[]>(6, []))
            setEquipmentTypes(getResult<EquipmentType[]>(7, []))

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

    // Selectable roles (ebay_variation_enabled = true)
    const selectableRoles = useMemo(() => {
        return roleConfigs.filter(rc => rc.ebay_variation_enabled === true)
    }, [roleConfigs])

    // Helper to resolve active assignment for a role
    const resolveActiveAssignmentForRole = (roleKey: string) => {
        return materialRoles.find(mr =>
            mr.role === roleKey &&
            (mr.end_date === null || mr.end_date === undefined || new Date(mr.end_date) > new Date())
        )
    }

    // Load surcharges for all selected roles
    const [surchargesByRole, setSurchargesByRole] = useState<Record<string, MaterialColourSurcharge[]>>({})

    useEffect(() => {
        const loadAllSurcharges = async () => {
            const newSurcharges: Record<string, MaterialColourSurcharge[]> = {}

            for (const roleKey of selectedRoleKeys) {
                const assignment = resolveActiveAssignmentForRole(roleKey)
                if (assignment?.material_id) {
                    try {
                        const surcharges = await materialsApi.listSurcharges(assignment.material_id)
                        newSurcharges[roleKey] = surcharges.filter(s => s.ebay_variation_enabled)
                    } catch (err) {
                        console.error(`Failed to load surcharges for role ${roleKey}:`, err)
                        newSurcharges[roleKey] = []
                    }
                }
            }

            setSurchargesByRole(newSurcharges)
        }

        if (selectedRoleKeys.length > 0) {
            loadAllSurcharges()
        } else {
            setSurchargesByRole({})
        }
    }, [selectedRoleKeys, materialRoles])

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

    // Filtered design options (only pricing relevant AND eBay variation enabled)
    const ebayDesignOptions = useMemo(() => {
        return designOptions
            .filter(opt => opt.is_pricing_relevant && opt.ebay_variation_enabled)
            .sort((a, b) => a.id - b.id) // Deterministic ordering by id
    }, [designOptions])

    // Handle role change - manage color selections
    const handleRoleChange = (roleKeys: string[]) => {
        setSelectedRoleKeys(roleKeys)

        // Clean up color selections for removed roles
        const newColorSelections: Record<string, number[]> = {}
        for (const roleKey of roleKeys) {
            newColorSelections[roleKey] = selectedColourSurchargeIdsByRole[roleKey] || []
        }
        setSelectedColourSurchargeIdsByRole(newColorSelections)
    }

    // Helper to format abbreviations (1-3 chars valid)
    const formatAbbrev = (abbrev?: string | null): string => {
        const trimmed = abbrev?.trim()
        if (!trimmed) return '(missing)'
        if (trimmed.length > 3) return `${trimmed} (invalid; max 3)`
        return trimmed
    }

    // Helper to format role SKU pair
    const formatRoleSkuPair = (noPad?: string | null, withPad?: string | null): string => {
        const validNoPad = noPad?.trim() && noPad.trim().length >= 1 && noPad.trim().length <= 3 ? noPad.trim() : null
        const validWithPad = withPad?.trim() && withPad.trim().length >= 1 && withPad.trim().length <= 3 ? withPad.trim() : null

        if (validNoPad && validWithPad && validNoPad !== validWithPad) {
            return `${validNoPad}, ${validWithPad}`
        }
        if (validNoPad) return validNoPad
        if (validWithPad) return validWithPad
        return '(missing)'
    }

    // Helper functions to format IDs into human-readable display
    const formatMaterialDisplay = (materialId: number): string => {
        const material = materials.find(m => m.id === materialId)
        if (!material) return `Material ${materialId}`
        const abbrev = material.sku_abbreviation ? ` (${material.sku_abbreviation})` : ''
        return `${material.name}${abbrev}`
    }

    const formatColorDisplay = (colorId: number | null, roleColorsList: MaterialColourSurcharge[]): string => {
        if (!colorId) return '-'
        const color = roleColorsList.find(c => c.id === colorId)
        if (!color) return `Color ${colorId}`
        const abbrev = color.sku_abbreviation ? ` (${color.sku_abbreviation})` : ''
        return `${color.colour}${abbrev}`
    }

    const formatDesignOptionsDisplay = (optionIds: number[]): string => {
        if (!optionIds || optionIds.length === 0) return '-'
        return optionIds.map(id => {
            const opt = designOptions.find(o => o.id === id)
            if (!opt) return `ID ${id}`
            const abbrev = opt.sku_abbreviation ? ` (${opt.sku_abbreviation})` : ''
            return `${opt.name}${abbrev}`
        }).join(', ')
    }

    // Handle load existing variations
    const handleLoadExisting = async () => {
        if (selectedModels.size === 0) return
        
        setLoadingExisting(true)
        setExistingVariations([])

        try {
            const modelIds = Array.from(selectedModels)
            const variations = await ebayVariationsApi.getExisting(modelIds)
            setExistingVariations(variations)
        } catch (err: any) {
            console.error('Failed to load existing variations:', err)
        } finally {
            setLoadingExisting(false)
        }
    }

    const handleGenerateVariations = async () => {
        setVariationError(null)
        setVariationResult(null)
        setGeneratingVariations(true)

        try {
            // Deterministic ordering
            const roleKeysSorted = [...selectedRoleKeys].sort()
            const modelIds = Array.from(selectedModels)

            let totalCreated = 0
            let totalUpdated = 0
            const allRows: VariationRow[] = []

            // Generate for each role × color combination
            for (const roleKey of roleKeysSorted) {
                const colorIds = selectedColourSurchargeIdsByRole[roleKey] || []
                const colorIdsSorted = [...new Set(colorIds)].sort((a, b) => a - b)

                for (const colorId of colorIdsSorted) {
                    const payload = {
                        model_ids: modelIds,
                        role_key: roleKey,
                        material_colour_surcharge_id: colorId,
                        design_option_ids: selectedDesignOptionIds
                    }

                    console.log('Generate Variations Payload:', payload)

                    const result = await ebayVariationsApi.generate(payload)
                    totalCreated += result.created
                    totalUpdated += result.updated
                    allRows.push(...result.rows)
                }
            }

            // Deduplicate by SKU (in case of overlaps)
            const uniqueRows = Array.from(
                new Map(allRows.map(row => [row.sku, row])).values()
            )

            setVariationResult({
                created: totalCreated,
                updated: totalUpdated,
                rows: uniqueRows
            })
        } catch (err: any) {
            // Handle structured error detail from backend
            const detail = err.response?.data?.detail
            
            if (typeof detail === 'object' && detail !== null) {
                // Structured error with invalid IDs
                let errorMsg = detail.message || 'Validation failed'
                const errorParts: string[] = [errorMsg]

                if (detail.missing_role_config_abbrev_no_padding) {
                    errorParts.push(`• Missing role config abbreviation (no padding) for role: ${detail.missing_role_config_abbrev_no_padding}`)
                }
                if (detail.missing_role_config_abbrev_with_padding) {
                    errorParts.push(`• Missing role config abbreviation (with padding) for role: ${detail.missing_role_config_abbrev_with_padding}`)
                }
                if (detail.invalid_material_id) {
                    errorParts.push(`• Invalid material ID: ${detail.invalid_material_id}`)
                }
                if (detail.invalid_color_id) {
                    errorParts.push(`• Invalid color ID: ${detail.invalid_color_id}`)
                }
                if (detail.invalid_design_option_ids && detail.invalid_design_option_ids.length > 0) {
                    errorParts.push(`• Invalid design option IDs: ${detail.invalid_design_option_ids.join(', ')}`)
                }

                setVariationError(errorParts.join('\n'))
            } else {
                // Fallback to string error
                const errorMessage = detail || err.message || 'Failed to generate variations'
                setVariationError(errorMessage)
            }
        } finally {
            setGeneratingVariations(false)
        }
    }

    // Check if all selected roles have at least one color
    const isGenerateEnabled = useMemo(() => {
        if (selectedModels.size === 0) return false
        if (selectedRoleKeys.length === 0) return false

        // Check that every selected role has at least one color
        for (const roleKey of selectedRoleKeys) {
            const colors = selectedColourSurchargeIdsByRole[roleKey] || []
            if (colors.length === 0) return false
        }

        return true
    }, [selectedModels, selectedRoleKeys, selectedColourSurchargeIdsByRole])

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

            {/* Models to Export Section */}
            <Paper sx={{ p: 3, mt: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Models to Export</Typography>
                    {selectedManufacturer && (
                        <Typography variant="body2" color="text.secondary">
                            Showing {filteredModels.length} models • {selectedModels.size} selected
                        </Typography>
                    )}
                </Box>
                
                {!selectedManufacturer ? (
                    <Alert severity="info">Select a manufacturer to view models.</Alert>
                ) : (
                    <TableContainer sx={{ maxHeight: 400 }}>
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
                                    <TableCell>Dimensions (W x D x H)</TableCell>
                                    <TableCell>Equipment Type</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredModels.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                                            <Typography variant="body2" color="text.secondary">
                                                No models found matching the filters.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredModels.map((model) => {
                                        const isSelected = selectedModels.has(model.id)
                                        const series = allSeries.find(s => s.id === model.series_id)
                                        const eqType = equipmentTypes.find(et => et.id === model.equipment_type_id)

                                        return (
                                            <TableRow 
                                                key={model.id} 
                                                hover
                                                selected={isSelected}
                                                onClick={(e) => {
                                                    // Allow row click to toggle selection, unless clicking checkbox directly (handled by its own onChange)
                                                    // Just purely logical toggle for simplicity here
                                                    const newSelected = new Set(selectedModels)
                                                    if (newSelected.has(model.id)) {
                                                        newSelected.delete(model.id)
                                                    } else {
                                                        newSelected.add(model.id)
                                                    }
                                                    setSelectedModels(newSelected)
                                                }}
                                                sx={{ cursor: 'pointer' }}
                                            >
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            e.stopPropagation() // Prevent row click double-toggle
                                                            const newSelected = new Set(selectedModels)
                                                            if (newSelected.has(model.id)) {
                                                                newSelected.delete(model.id)
                                                            } else {
                                                                newSelected.add(model.id)
                                                            }
                                                            setSelectedModels(newSelected)
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>{model.name}</TableCell>
                                                <TableCell>{series?.name || '-'}</TableCell>
                                                <TableCell>{`${model.width || '-'} " x ${model.depth || '-'} " x ${model.height || '-'} "`}</TableCell>
                                                <TableCell>{eqType?.name || '-'}</TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            {/* Variation Inputs Section */}
            <Paper sx={{ p: 3, mt: 3 }}>
                <Typography variant="h6" gutterBottom>Variation Inputs</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    Select material roles, colors per role, and design options for eBay variation SKU generation.
                </Typography>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={12}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Material Roles</InputLabel>
                            <Select
                                multiple
                                value={selectedRoleKeys}
                                label="Material Roles"
                                onChange={(e) => {
                                    const value = e.target.value
                                    handleRoleChange(typeof value === 'string' ? [] : value as string[])
                                }}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((roleKey) => {
                                            const rc = roleConfigs.find(r => r.role === roleKey)
                                            return <Chip key={roleKey} label={rc?.display_name || roleKey} size="small" />
                                        })}
                                    </Box>
                                )}
                            >
                                {selectableRoles.map(rc => {
                                    const skuPair = formatRoleSkuPair(rc.sku_abbrev_no_padding, rc.sku_abbrev_with_padding)
                                    return (
                                        <MenuItem key={rc.role} value={rc.role}>
                                            {rc.display_name || rc.role} ({rc.role}) — {skuPair}
                                        </MenuItem>
                                    )
                                })}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Color dropdowns - one per selected role */}
                    {selectedRoleKeys.map((roleKey) => {
                        const roleConfig = roleConfigs.find(rc => rc.role === roleKey)
                        const assignment = resolveActiveAssignmentForRole(roleKey)
                        const material = materials.find(m => m.id === assignment?.material_id)
                        const colors = surchargesByRole[roleKey] || []

                        return (
                            <Grid item xs={12} key={roleKey}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Colors for {roleConfig?.display_name || roleKey}</InputLabel>
                                    <Select
                                        multiple
                                        value={selectedColourSurchargeIdsByRole[roleKey] || []}
                                        label={`Colors for ${roleConfig?.display_name || roleKey}`}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            const newColors = typeof value === 'string' ? [] : value as number[]
                                            setSelectedColourSurchargeIdsByRole({
                                                ...selectedColourSurchargeIdsByRole,
                                                [roleKey]: newColors
                                            })
                                        }}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((colorId) => {
                                                    const color = colors.find(c => c.id === colorId)
                                                    return (
                                                        <Chip
                                                            key={colorId}
                                                            label={color?.color_friendly_name || color?.colour || `ID ${colorId}`}
                                                            size="small"
                                                        />
                                                    )
                                                })}
                                            </Box>
                                        )}
                                    >
                                        {colors.map(color => (
                                            <MenuItem key={color.id} value={color.id}>
                                                {color.color_friendly_name || color.colour} (${color.surcharge.toFixed(2)})
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )
                    })}

                    <Grid item xs={12}>
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
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((id) => {
                                            const opt = designOptions.find(o => o.id === id)
                                            return <Chip key={id} label={opt?.name || `ID ${id}`} size="small" />
                                        })}
                                    </Box>
                                )}
                            >
                                {ebayDesignOptions.map(opt => (
                                    <MenuItem key={opt.id} value={opt.id}>{opt.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                </Grid>
            </Paper>

            <Box sx={{ mt: 3 }}>
                <Button
                    variant="contained"
                    onClick={handleGenerateVariations}
                    disabled={!isGenerateEnabled || generatingVariations}
                    sx={{ mr: 2 }}
                >
                    {generatingVariations ? 'Generating...' : 'Generate Variations'}
                </Button>
                <Button
                    variant="outlined"
                    onClick={handleLoadExisting}
                    disabled={selectedModels.size === 0 || loadingExisting}
                >
                    {loadingExisting ? 'Loading...' : 'Load Existing Variations'}
                </Button>
            </Box>

            {/* Error Display */}
            {variationError && (
                <Alert severity="error" sx={{ mt: 2, whiteSpace: 'pre-line' }}>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Box>
                </Paper>
            )}

            {/* Existing Variations Table */}
            {existingVariations.length > 0 && (
                <Paper sx={{ mt: 3, p: 2 }}>
                    <Typography variant="h6" gutterBottom>
                        Existing Variations ({existingVariations.length} found)
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
                                </tr>
                            </thead>
                            <tbody>
                                {existingVariations.map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '8px' }}>{row.model_id}</td>
                                        <td style={{ padding: '8px', fontFamily: 'monospace' }}>{row.sku}</td>
                                        <td style={{ padding: '8px' }}>{formatMaterialDisplay(row.material_id)}</td>
                                        <td style={{ padding: '8px' }}>{formatColorDisplay(row.material_colour_surcharge_id, Object.values(surchargesByRole).flat())}</td>
                                        <td style={{ padding: '8px' }}>{formatDesignOptionsDisplay(row.design_option_ids)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Box>
                </Paper>
            )}

            {/* Selected Variation Summary (Read-Only) */}
            {selectedRoleKeys.length > 0 && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Selected Variation Summary (Read-Only)
                    </Typography>

                    {/* Active Role Assignments */}
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" fontWeight="bold" gutterBottom>
                            Active Role Assignments:
                        </Typography>
                        {selectedRoleKeys.map(roleKey => {
                            const activeAssignment = resolveActiveAssignmentForRole(roleKey)
                            const material = materials.find(m => m.id === activeAssignment?.material_id)
                            const roleConfig = roleConfigs.find(rc => rc.role === roleKey)
                            const skuPair = formatRoleSkuPair(roleConfig?.sku_abbrev_no_padding, roleConfig?.sku_abbrev_with_padding)
                            const selectedColors = selectedColourSurchargeIdsByRole[roleKey] || []
                            const roleColors = surchargesByRole[roleKey] || []

                            return (
                                <Box key={roleKey} sx={{ mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                        • {roleKey} → {material?.name || 'Unknown Material'} {activeAssignment ? `(effective ${new Date(activeAssignment.effective_date).toLocaleDateString()})` : ''} — Role SKU: {skuPair}
                                    </Typography>
                                    {selectedColors.length > 0 && (
                                        <Typography variant="body2" color="text.secondary" sx={{ pl: 4 }}>
                                            Colors: {selectedColors.map(colorId => {
                                                const color = roleColors.find(c => c.id === colorId)
                                                if (!color) return `ID ${colorId}`
                                                const name = color.color_friendly_name || color.colour
                                                const abbrev = color.sku_abbreviation || '-'
                                                return `${name} (${abbrev}, $${color.surcharge.toFixed(2)})`
                                            }).join(', ')}
                                        </Typography>
                                    )}
                                </Box>
                            )
                        })}
                    </Box>

                    {selectedDesignOptionIds.length > 0 && (
                        <Box>
                            <Typography variant="body2" fontWeight="bold">
                                Design Option SKU Abbreviations:
                            </Typography>
                            {selectedDesignOptionIds
                                .map(id => designOptions.find(opt => opt.id === id))
                                .filter(Boolean)
                                .sort((a, b) => (a?.id || 0) - (b?.id || 0))
                                .map(opt => (
                                    <Typography key={opt?.id} variant="body2" color="text.secondary" sx={{ pl: 2 }}>
                                        • {opt?.name}: {formatAbbrev(opt?.sku_abbreviation)}
                                    </Typography>
                                ))}
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    )
}
