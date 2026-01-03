import React, { useState, useEffect, useMemo } from 'react'
import {
    Box, Typography, Paper, Button, Alert,
    Divider, IconButton, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Chip, Stack, TextField,
    InputAdornment, Dialog, DialogTitle, DialogContent,
    DialogActions, Switch, FormControlLabel
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import RefreshIcon from '@mui/icons-material/Refresh'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'

import {
    ebayTemplatesApi, EbayTemplateResponse, EbayTemplateParseSummary,
    EbayFieldResponse, EbayValidValueDetailed
} from '../services/api'

// --- Component: Valid Values Section in Modal ---
const ValidValuesSection = ({
    values,
    valuesDetailed,
    selectedValue,
    onChipClick,
    onDeleteValue,
    newValue,
    onNewValueChange,
    onAddValue,
    savingAdd
}: {
    values: string[],
    valuesDetailed?: EbayValidValueDetailed[],
    selectedValue: string | null | undefined,
    onChipClick: (value: string) => void,
    onDeleteValue: (valueId: number, valueName: string) => void,
    newValue: string,
    onNewValueChange: (value: string) => void,
    onAddValue: () => void,
    savingAdd: boolean
}) => {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredValues = useMemo(() => {
        if (valuesDetailed && valuesDetailed.length > 0) {
            // Use detailed values if available
            if (!searchTerm) return valuesDetailed
            return valuesDetailed.filter(v => v.value.toLowerCase().includes(searchTerm.toLowerCase()))
        } else {
            // Fallback to string array
            if (!values) return []
            if (!searchTerm) return values.map((v, i) => ({ id: i, value: v }))
            return values.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase())).map((v, i) => ({ id: i, value: v }))
        }
    }, [values, valuesDetailed, searchTerm])

    const canAdd = newValue.trim().length > 0 && !savingAdd

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
                Valid Values ({values?.length || 0})
            </Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <TextField
                    placeholder="Search values..."
                    size="small"
                    fullWidth
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon fontSize="small" />
                            </InputAdornment>
                        )
                    }}
                />
            </Stack>

            <Box sx={{
                maxHeight: 200,
                overflowY: 'auto',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 1.5,
                mb: 2
            }}>
                {filteredValues && filteredValues.length > 0 ? (
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                        {/* Any/Clear option */}
                        <Chip
                            label="Any"
                            size="small"
                            color={!selectedValue ? "primary" : "default"}
                            variant={!selectedValue ? "filled" : "outlined"}
                            onClick={() => onChipClick("Any")}
                            sx={{ cursor: 'pointer' }}
                        />
                        {filteredValues.map((v) => (
                            <Chip
                                key={v.id}
                                label={v.value}
                                size="small"
                                color={selectedValue === v.value ? "primary" : "default"}
                                variant={selectedValue === v.value ? "filled" : "outlined"}
                                onClick={() => onChipClick(v.value)}
                                onDelete={valuesDetailed && valuesDetailed.length > 0 ? (e) => {
                                    e.stopPropagation()
                                    if (window.confirm(`Delete value "${v.value}"?`)) {
                                        onDeleteValue(v.id, v.value)
                                    }
                                } : undefined}
                                sx={{ cursor: 'pointer' }}
                            />
                        ))}
                        {filteredValues.length === 0 && (
                            <Typography variant="caption" color="text.secondary">No matching values found</Typography>
                        )}
                    </Stack>
                ) : (
                    <Typography variant="caption" color="text.secondary">No valid values defined.</Typography>
                )}
            </Box>

            {/* Add Value Area */}
            <Stack direction="row" spacing={1}>
                <TextField
                    size="small"
                    placeholder="Add new value..."
                    value={newValue}
                    onChange={(e) => onNewValueChange(e.target.value)}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && canAdd) {
                            onAddValue()
                        }
                    }}
                    disabled={savingAdd}
                    fullWidth
                    helperText={savingAdd ? "Saving..." : "Press Enter or click Add"}
                />
                <Button
                    variant="contained"
                    onClick={onAddValue}
                    disabled={!canAdd}
                    startIcon={<AddIcon />}
                >
                    Add
                </Button>
            </Stack>
        </Box>
    )
}

// --- Component: Field Details Modal ---
const FieldDetailsModal = ({
    open,
    field,
    onClose,
    onFieldUpdated
}: {
    open: boolean,
    field: EbayFieldResponse | null,
    onClose: () => void,
    onFieldUpdated: (updatedField: EbayFieldResponse) => void
}) => {
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [localField, setLocalField] = useState<EbayFieldResponse | null>(field)
    const [newValue, setNewValue] = useState('')
    const [savingAdd, setSavingAdd] = useState(false)

    // Update local field when prop changes
    useEffect(() => {
        setLocalField(field)
        setError(null)
    }, [field])

    if (!localField) return null

    const handleRequiredToggle = async (checked: boolean) => {
        setSaving(true)
        setError(null)
        try {
            const updated = await ebayTemplatesApi.updateField(localField.id, { required: checked })
            setLocalField(updated)
            onFieldUpdated(updated)
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to update required status')
            // Revert by resetting localField
            setLocalField(localField)
        } finally {
            setSaving(false)
        }
    }

    const handleChipClick = async (value: string) => {
        setSaving(true)
        setError(null)
        try {
            const updated = await ebayTemplatesApi.updateField(localField.id, {
                selected_value: value,
                custom_value: null
            })
            setLocalField(updated)
            onFieldUpdated(updated)
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to update selected value')
        } finally {
            setSaving(false)
        }
    }

    const handleAddValue = async () => {
        const trimmedValue = newValue.trim()
        if (!trimmedValue) return

        setSavingAdd(true)
        setError(null)
        try {
            const updated = await ebayTemplatesApi.addValidValue(localField.id, trimmedValue)
            setLocalField(updated)
            onFieldUpdated(updated)
            setNewValue('') // Clear input on success
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to add valid value')
        } finally {
            setSavingAdd(false)
        }
    }

    const handleDeleteValue = async (valueId: number, valueName: string) => {
        setSaving(true)
        setError(null)
        try {
            const updated = await ebayTemplatesApi.deleteValidValue(localField.id, valueId)
            setLocalField(updated)
            onFieldUpdated(updated)
        } catch (err: any) {
            setError(err.response?.data?.detail || `Failed to delete value "${valueName}"`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{localField.field_name}</Typography>
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                <Typography variant="caption" color="text.secondary">
                    Order Index: {localField.order_index} | ID: {localField.id}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3}>
                    {error && (
                        <Alert severity="error" onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    {/* Required Toggle */}
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={localField.required}
                                    onChange={(e) => handleRequiredToggle(e.target.checked)}
                                    disabled={saving}
                                />
                            }
                            label="Required"
                        />
                        {saving && (
                            <Typography variant="caption" display="block" color="primary" sx={{ ml: 4 }}>
                                Saving...
                            </Typography>
                        )}
                    </Box>

                    {/* Default Value */}
                    <TextField
                        label="Default / Selected Value"
                        fullWidth
                        value={localField.selected_value || "Any"}
                        InputProps={{ readOnly: true }}
                        disabled={saving}
                        helperText="Click a chip below to select a value"
                    />

                    {/* Valid Values */}
                    <ValidValuesSection
                        values={localField.allowed_values}
                        valuesDetailed={localField.allowed_values_detailed}
                        selectedValue={localField.selected_value}
                        onChipClick={handleChipClick}
                        onDeleteValue={handleDeleteValue}
                        newValue={newValue}
                        onNewValueChange={setNewValue}
                        onAddValue={handleAddValue}
                        savingAdd={savingAdd}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    )
}

// --- Main Page Component ---
export default function EbayTemplatesPage() {
    const [currentTemplate, setCurrentTemplate] = useState<EbayTemplateResponse | null>(null)
    const [parsedFields, setParsedFields] = useState<EbayFieldResponse[]>([])
    const [parseSummary, setParseSummary] = useState<EbayTemplateParseSummary | null>(null)
    const [selectedField, setSelectedField] = useState<EbayFieldResponse | null>(null)
    const [modalOpen, setModalOpen] = useState(false)

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const [savingRequiredById, setSavingRequiredById] = useState<Record<number, boolean>>({})

    const loadCurrentTemplate = async () => {
        setLoading(true)
        setError(null)
        try {
            const tmpl = await ebayTemplatesApi.getCurrent()
            setCurrentTemplate(tmpl)

            if (tmpl) {
                try {
                    const fieldsResp = await ebayTemplatesApi.getFields(tmpl.id)
                    setParsedFields(fieldsResp.fields)
                } catch (e) {
                    setParsedFields([])
                }
            } else {
                setParsedFields([])
                setParseSummary(null)
            }
        } catch (err: any) {
            setError(`Failed to load current template: ${err.message || String(err)}`)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadCurrentTemplate()
    }, [])

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        if (!file.name.endsWith('.xlsx')) {
            setError("Please upload a .xlsx file")
            return
        }

        setLoading(true)
        setError(null)
        setSuccessMsg(null)
        setParseSummary(null)
        setParsedFields([])

        try {
            const resp = await ebayTemplatesApi.upload(file)
            setCurrentTemplate(resp)
            setSuccessMsg("Template uploaded successfully.")
        } catch (err: any) {
            setError(`Upload failed: ${err.message || String(err)}`)
        } finally {
            setLoading(false)
            event.target.value = ''
        }
    }

    const handleParse = async () => {
        if (!currentTemplate) return

        setLoading(true)
        setError(null)
        setSuccessMsg(null)

        try {
            const summary = await ebayTemplatesApi.parse(currentTemplate.id)
            setParseSummary(summary)

            // Refetch to get fresh data
            const fieldsResp = await ebayTemplatesApi.getFields(currentTemplate.id)
            setParsedFields(fieldsResp.fields)

            setSuccessMsg("Template parsed successfully.")
        } catch (err: any) {
            setError(`Parse failed: ${err.message || String(err)}`)
        } finally {
            setLoading(false)
        }
    }

    const handleInlineRequiredToggle = async (fieldId: number, checked: boolean) => {
        // Set saving state for this field
        setSavingRequiredById(prev => ({ ...prev, [fieldId]: true }))

        try {
            const updated = await ebayTemplatesApi.updateField(fieldId, { required: checked })

            // Update parsedFields with the returned field
            setParsedFields(prev => prev.map(f => f.id === fieldId ? updated : f))

            // If the modal is open for this field, update selectedField too
            if (selectedField?.id === fieldId) {
                setSelectedField(updated)
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to update required status')
            // No need to revert since we update on success only
        } finally {
            setSavingRequiredById(prev => ({ ...prev, [fieldId]: false }))
        }
    }

    const handleRowClick = (field: EbayFieldResponse) => {
        setSelectedField(field)
        setModalOpen(true)
    }

    return (
        <Box sx={{ p: 3, pt: 2, height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
            {/* Header / Top Bar */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h5">eBay Templates</Typography>
                <Stack direction="row" spacing={2}>
                    {currentTemplate ? (
                        <Paper sx={{ px: 2, py: 0.5, display: 'flex', alignItems: 'center', gap: 2 }} variant="outlined">
                            <Box>
                                <Typography variant="caption" display="block" color="text.secondary">Current Template</Typography>
                                <Typography variant="body2" fontWeight="bold">{currentTemplate.original_filename}</Typography>
                            </Box>
                            <Divider orientation="vertical" flexItem />
                            <Box>
                                <Typography variant="caption" display="block" color="text.secondary">Uploaded</Typography>
                                <Typography variant="body2">{new Date(currentTemplate.uploaded_at || '').toLocaleDateString()}</Typography>
                            </Box>
                        </Paper>
                    ) : (
                        <Alert severity="info" sx={{ py: 0 }}>No template uploaded</Alert>
                    )}

                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={loadCurrentTemplate}
                        disabled={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        component="label"
                        variant="outlined"
                        startIcon={<CloudUploadIcon />}
                        disabled={loading}
                    >
                        Upload
                        <input type="file" hidden accept=".xlsx" onChange={handleUpload} />
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PlayArrowIcon />}
                        onClick={handleParse}
                        disabled={loading || !currentTemplate}
                    >
                        Parse
                    </Button>
                </Stack>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
            {successMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}

            {parseSummary && (
                <Alert severity="info" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
                    Parse Results: {parseSummary.fields_inserted} fields, {parseSummary.values_inserted} allowed values, {parseSummary.defaults_applied} defaults applied.
                </Alert>
            )}

            {/* Amazon-style Table Layout */}
            {parsedFields.length > 0 ? (
                <Paper sx={{ flex: 1, overflow: 'hidden' }} variant="outlined">
                    <TableContainer sx={{ height: '100%' }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Field Name</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '20%' }}>Required</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Default / Selected Value</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {parsedFields.map((field) => (
                                    <TableRow
                                        key={field.id}
                                        hover
                                        onClick={() => handleRowClick(field)}
                                        sx={{ cursor: 'pointer' }}
                                    >
                                        <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                            {field.field_name}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                                <Switch
                                                    checked={field.required}
                                                    disabled={!!savingRequiredById[field.id]}
                                                    size="small"
                                                    color={field.required ? "primary" : "default"}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onChange={(e) => handleInlineRequiredToggle(field.id, e.target.checked)}
                                                />
                                                {savingRequiredById[field.id] && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                        Saving...
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {(() => {
                                                    const valueCount = (field.allowed_values_detailed?.length ?? field.allowed_values?.length ?? 0)

                                                    if (valueCount === 0) {
                                                        return (
                                                            <Typography variant="caption" color="text.secondary">
                                                                (0)
                                                            </Typography>
                                                        )
                                                    }

                                                    return (
                                                        <>
                                                            <Typography
                                                                variant="body2"
                                                                color={field.selected_value ? "primary" : "text.primary"}
                                                                fontWeight={field.selected_value ? "medium" : "normal"}
                                                            >
                                                                {field.selected_value || "Any"}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                ({valueCount})
                                                            </Typography>
                                                        </>
                                                    )
                                                })()}
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            ) : (
                <Paper sx={{ p: 5, textAlign: 'center', mt: 4 }} variant="outlined">
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        No fields found.
                    </Typography>
                    <Typography color="text.secondary">
                        Upload a template and click "Parse" to begin.
                    </Typography>
                </Paper>
            )}

            {/* Field Details Modal */}
            <FieldDetailsModal
                open={modalOpen}
                field={selectedField}
                onClose={() => setModalOpen(false)}
                onFieldUpdated={(updatedField) => {
                    // Update the field in parsedFields array
                    setParsedFields(prev => prev.map(f =>
                        f.id === updatedField.id ? updatedField : f
                    ))
                    // Also update selectedField so modal shows latest data
                    setSelectedField(updatedField)
                }}
            />
        </Box>
    )
}
