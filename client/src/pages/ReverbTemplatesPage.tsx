import React, { useState, useEffect, useMemo } from 'react'
import {
    Box, Typography, Paper, Button, Alert,
    Divider, IconButton, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Chip, Stack, TextField,
    Dialog, DialogTitle, DialogContent, DialogActions,
    CircularProgress, Switch, FormControlLabel,
    Autocomplete, MenuItem
} from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import EditIcon from '@mui/icons-material/Edit'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'


import {
    reverbTemplatesApi, ReverbTemplateResponse, ReverbTemplateParseSummary,
    ReverbFieldResponse, ReverbValidValueDetailed, ReverbTemplatePreviewResponse,
    equipmentTypesApi, settingsApi
} from '../services/api'
import type { EquipmentType } from '../types'

// --- Component: Valid Values Section in Modal ---
// Fields that support Equipment Type assignment on values
const ASSIGNABLE_FIELDS = ['description', 'product_type', 'subcategory_1']

function ValidValuesSection({
    fieldName,
    values,
    valuesDetailed,
    selectedValue,
    onChipClick,
    onValueEdit,
    onDeleteValue,
    newValue,
    onNewValueChange,
    onAddValue,
    savingAdd
}: {
    fieldName: string,
    values: string[],
    valuesDetailed?: ReverbValidValueDetailed[],
    selectedValue?: string | null,
    onChipClick: (value: string) => void,
    onValueEdit?: (valueId: number, valueName: string) => void,
    onDeleteValue: (valueId: number, valueName: string) => void,
    newValue: string,
    onNewValueChange: (value: string) => void,
    onAddValue: () => void,
    savingAdd: boolean
}) {
    const isAssignable = ASSIGNABLE_FIELDS.includes(fieldName.toLowerCase())

    const handleChipClick = (val: string) => {
        const detail = valuesDetailed?.find(v => v.value === val)
        if (isAssignable && detail && onValueEdit) {
            // Open edit dialog for assignable fields
            onValueEdit(detail.id, val)
        } else {
            // Toggle selection for non-assignable fields
            onChipClick(val)
        }
    }

    return (
        <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" gutterBottom>
                Allowed Values ({values.length})
                {isAssignable && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        (Click a value to assign Equipment Types)
                    </Typography>
                )}
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, minHeight: 100, maxHeight: 300, overflowY: 'auto' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {values.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                            No restricted values defined. Any value is allowed unless configured otherwise.
                        </Typography>
                    )}
                    {values.map((val) => {
                        const isSelected = val === selectedValue
                        const detail = valuesDetailed?.find(v => v.value === val)
                        const valueId = detail?.id

                        return (
                            <Chip
                                key={val}
                                label={val}
                                onClick={() => handleChipClick(val)}
                                onDelete={valueId ? () => onDeleteValue(valueId, val) : undefined}
                                color={isSelected ? "primary" : "default"}
                                variant={isSelected ? "filled" : "outlined"}
                                sx={{ cursor: 'pointer' }}
                            />
                        )
                    })}
                </Box>
            </Paper>

            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <TextField
                    size="small"
                    placeholder="Add allowed value..."
                    value={newValue}
                    onChange={(e) => onNewValueChange(e.target.value)}
                    fullWidth
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            onAddValue()
                        }
                    }}
                />
                <Button
                    variant="contained"
                    onClick={onAddValue}
                    disabled={!newValue.trim() || savingAdd}
                    startIcon={savingAdd ? <CircularProgress size={20} /> : <AddIcon />}
                    sx={{ whiteSpace: 'nowrap' }}
                >
                    Add
                </Button>
            </Box>
        </Box>
    )
}

// --- Component: Edit Value Dialog (for assigning Equipment Types) ---
function EditValueDialog({
    open,
    valueId,
    valueName,
    field,
    equipmentTypes,
    onClose,
    onSave
}: {
    open: boolean,
    valueId: number | null,
    valueName: string,
    field: ReverbFieldResponse | null,
    equipmentTypes: EquipmentType[],
    onClose: () => void,
    onSave: (updatedField: ReverbFieldResponse) => void
}) {
    const [selectedEtIds, setSelectedEtIds] = useState<number[]>([])
    const [isDefault, setIsDefault] = useState(false)
    const [saving, setSaving] = useState(false)

    // Initialize from field overrides when dialog opens
    useEffect(() => {
        if (open && field && valueName) {
            // Find which Equipment Types currently have this value as override
            const assignedEtIds = (field.overrides || [])
                .filter(o => o.default_value === valueName)
                .map(o => o.equipment_type_id)
            setSelectedEtIds(assignedEtIds)

            // Check if this is the selected/default value for the field
            setIsDefault(field.selected_value === valueName)
        }
    }, [open, field, valueName])

    const handleSave = async () => {
        if (!field || !valueId) return
        setSaving(true)

        try {
            let currentField = field

            // 1. Update default status if changed
            if (isDefault && field.selected_value !== valueName) {
                currentField = await reverbTemplatesApi.updateField(field.id, { selected_value: valueName })
            } else if (!isDefault && field.selected_value === valueName) {
                currentField = await reverbTemplatesApi.updateField(field.id, { selected_value: '' })
            }

            // 2. Update Equipment Type overrides
            const currentOverrides = (field.overrides || [])
                .filter(o => o.default_value === valueName)
                .map(o => o.equipment_type_id)

            // Add new overrides
            for (const etId of selectedEtIds) {
                if (!currentOverrides.includes(etId)) {
                    currentField = await reverbTemplatesApi.createFieldOverride(field.id, etId, valueName)
                }
            }

            // Remove old overrides
            for (const etId of currentOverrides) {
                if (!selectedEtIds.includes(etId)) {
                    const override = (field.overrides || []).find(o => o.equipment_type_id === etId && o.default_value === valueName)
                    if (override) {
                        currentField = await reverbTemplatesApi.deleteFieldOverride(field.id, override.id)
                    }
                }
            }

            onSave(currentField)
            onClose()
        } catch (err) {
            console.error("Failed to save value assignment:", err)
            alert("Failed to save changes.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Value</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3}>
                    <TextField
                        label="Name"
                        value={valueName}
                        fullWidth
                        disabled
                        size="small"
                    />

                    <Autocomplete
                        multiple
                        options={equipmentTypes}
                        getOptionLabel={(option) => option.name}
                        value={equipmentTypes.filter(et => selectedEtIds.includes(et.id))}
                        onChange={(_, newValue) => {
                            setSelectedEtIds(newValue.map(v => v.id))
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Assigned Equipment Types"
                                variant="outlined"
                                size="small"
                                helperText="Models of these Equipment Types will use this value."
                            />
                        )}
                        renderTags={(value, getTagProps) =>
                            value.map((option, index) => (
                                <Chip variant="outlined" label={option.name} size="small" {...getTagProps({ index })} />
                            ))
                        }
                    />

                    <FormControlLabel
                        control={
                            <Switch
                                checked={isDefault}
                                onChange={(e) => setIsDefault(e.target.checked)}
                            />
                        }
                        label="Set as default?"
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: -2 }}>
                        If enabled, this value will be used for all Equipment Types without a specific override.
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={saving}>
                    {saving ? <CircularProgress size={24} /> : "Save"}
                </Button>
            </DialogActions>
        </Dialog>
    )
}


// --- Component: Field Details Modal ---
function FieldDetailsModal({
    open,
    field,
    equipmentTypes,
    onClose,
    onFieldUpdated
}: {
    open: boolean,
    field: ReverbFieldResponse | null,
    equipmentTypes: EquipmentType[],
    onClose: () => void,
    onFieldUpdated: (updatedField: ReverbFieldResponse) => void
}) {
    const [newValue, setNewValue] = useState("")
    const [savingAdd, setSavingAdd] = useState(false)
    const [localRequired, setLocalRequired] = useState(false)

    // Edit Value Dialog State
    const [editValueDialogOpen, setEditValueDialogOpen] = useState(false)
    const [editingValueId, setEditingValueId] = useState<number | null>(null)
    const [editingValueName, setEditingValueName] = useState("")

    useEffect(() => {
        if (open && field) {
            setNewValue("")
            setSavingAdd(false)
            setLocalRequired(field.required)
        }
    }, [open, field?.id])



    if (!field) return null

    const handleRequiredToggle = async (checked: boolean) => {
        setLocalRequired(checked)
        try {
            const updated = await reverbTemplatesApi.updateField(field.id, { required: checked })
            onFieldUpdated(updated)
        } catch (err) {
            console.error("Failed to update required status:", err)
            // Revert on error
            setLocalRequired(!checked)
        }
    }

    const handleChipClick = async (value: string) => {
        // Toggle selection
        const newSelection = field.selected_value === value ? "" : value // Empty string to clear
        try {
            const updated = await reverbTemplatesApi.updateField(field.id, { selected_value: newSelection })
            onFieldUpdated(updated)
        } catch (err) {
            console.error("Failed to update selection:", err)
        }
    }

    const handleAddValue = async () => {
        const val = newValue.trim()
        if (!val) return

        setSavingAdd(true)
        try {
            const updated = await reverbTemplatesApi.addValidValue(field.id, val)
            onFieldUpdated(updated)
            setNewValue("")
        } catch (err) {
            console.error("Failed to add value:", err)
            alert("Failed to add value. It may be a duplicate.")
        } finally {
            setSavingAdd(false)
        }
    }

    const handleValueEdit = (valueId: number, valueName: string) => {
        setEditingValueId(valueId)
        setEditingValueName(valueName)
        setEditValueDialogOpen(true)
    }



    const handleDeleteValue = async (valueId: number, valueName: string) => {
        if (!window.confirm(`Delete allowed value "${valueName}"?`)) return
        try {
            const updated = await reverbTemplatesApi.deleteValidValue(field.id, valueId)
            onFieldUpdated(updated)
        } catch (err) {
            console.error("Failed to delete value:", err)
            alert("Failed to delete value.")
        }
    }



    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                Edit Field: {field.display_name || field.field_name}
                <Typography variant="caption" display="block" color="text.secondary">
                    CSV Header: {field.field_name}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={localRequired}
                                onChange={(e) => handleRequiredToggle(e.target.checked)}
                            />
                        }
                        label="Required Field"
                    />

                    <Divider />

                    <ValidValuesSection
                        fieldName={field.field_name}
                        values={field.allowed_values}
                        valuesDetailed={field.allowed_values_detailed}
                        selectedValue={field.selected_value}
                        onChipClick={handleChipClick}
                        onValueEdit={handleValueEdit}
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

            {/* Edit Value Dialog for Equipment Type Assignment */}
            <EditValueDialog
                open={editValueDialogOpen}
                valueId={editingValueId}
                valueName={editingValueName}
                field={field}
                equipmentTypes={equipmentTypes}
                onClose={() => setEditValueDialogOpen(false)}
                onSave={onFieldUpdated}
            />
        </Dialog>
    )
}

// --- Main Page Component ---
export default function ReverbTemplatesPage() {
    const [currentTemplate, setCurrentTemplate] = useState<ReverbTemplateResponse | null>(null)
    const [fields, setFields] = useState<ReverbFieldResponse[]>([])
    const [loading, setLoading] = useState(false)
    const [parsing, setParsing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [parseSummary, setParseSummary] = useState<ReverbTemplateParseSummary | null>(null)

    // Modal State
    const [selectedField, setSelectedField] = useState<ReverbFieldResponse | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Preview Modal State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [previewData, setPreviewData] = useState<ReverbTemplatePreviewResponse | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(false)

    // Linking State
    const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
    const [linkEtId, setLinkEtId] = useState<number | ''>('')
    const [linking, setLinking] = useState(false)

    // Load initial data
    useEffect(() => {
        loadCurrentTemplate()
    }, [])

    const loadCurrentTemplate = async () => {
        setLoading(true)
        setError(null)
        try {
            const [tmpl, ets] = await Promise.all([
                reverbTemplatesApi.getCurrent(),
                equipmentTypesApi.list()
            ])

            setCurrentTemplate(tmpl)
            setEquipmentTypes(ets)

            if (tmpl) {
                // If template exists, try to load fields
                const fieldsResp = await reverbTemplatesApi.getFields(tmpl.id).catch(() => null)
                if (fieldsResp) {
                    setFields(fieldsResp.fields)
                }
            }
        } catch (err) {
            console.error("Failed to load template data:", err)
            setError("Failed to load current template data.")
        } finally {
            setLoading(false)
        }
    }

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return

        const file = event.target.files[0]
        setLoading(true)
        setError(null)
        setParseSummary(null)

        try {
            const tmpl = await reverbTemplatesApi.upload(file)
            setCurrentTemplate(tmpl)
            // Clear fields as new template uploaded
            setFields([])
            // Auto-parse
            setParsing(true)
            const summary = await reverbTemplatesApi.parse(tmpl.id)
            setParseSummary(summary)
            const fieldsResp = await reverbTemplatesApi.getFields(tmpl.id)
            setFields(fieldsResp.fields)
        } catch (err: any) {
            console.error("Upload failed:", err)
            setError(err.response?.data?.detail || "Upload failed")
        } finally {
            setLoading(false)
            setParsing(false)
            // Reset file input
            event.target.value = ''
        }
    }

    const handleParse = async () => {
        if (!currentTemplate) return
        setParsing(true)
        setError(null)
        try {
            const summary = await reverbTemplatesApi.parse(currentTemplate.id)
            setParseSummary(summary)
            const fieldsResp = await reverbTemplatesApi.getFields(currentTemplate.id)
            setFields(fieldsResp.fields)
        } catch (err: any) {
            console.error("Parse failed:", err)
            setError(err.response?.data?.detail || "Parse failed")
        } finally {
            setParsing(false)
        }
    }

    const handleInlineRequiredToggle = async (fieldId: number, checked: boolean) => {
        // Optimistic update
        setFields(prev => prev.map(f => f.id === fieldId ? { ...f, required: checked } : f))

        try {
            await reverbTemplatesApi.updateField(fieldId, { required: checked })
        } catch (err) {
            console.error("Update failed:", err)
            // Revert
            setFields(prev => prev.map(f => f.id === fieldId ? { ...f, required: !checked } : f))
        }
    }

    const handleRowClick = (field: ReverbFieldResponse) => {
        setSelectedField(field)
        setIsModalOpen(true)
    }

    const handlePreview = async () => {
        setLoadingPreview(true)
        setIsPreviewOpen(true)
        try {
            const data = await reverbTemplatesApi.previewCurrentTemplate()
            setPreviewData(data)
        } catch (err) {
            console.error(err)
            setError("Failed to load preview")
        } finally {
            setLoadingPreview(false)
        }
    }

    const handleLinkEquipmentType = async () => {
        if (!currentTemplate || !linkEtId) return
        setLinking(true)
        try {
            await settingsApi.assignReverbTemplate(linkEtId as number, currentTemplate.id)
            setLinkEtId('')
            // Refresh ETs
            const ets = await equipmentTypesApi.list()
            setEquipmentTypes(ets)
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.detail || "Failed to link Equipment Type")
        } finally {
            setLinking(false)
        }
    }

    const handleUnlinkEquipmentType = async (etId: number) => {
        if (!window.confirm("Are you sure you want to unlink this Equipment Type?")) return
        try {
            await settingsApi.assignReverbTemplate(etId, null)
            // Refresh ETs
            const ets = await equipmentTypesApi.list()
            setEquipmentTypes(ets)
        } catch (err: any) {
            console.error(err)
            setError(err.response?.data?.detail || "Failed to unlink Equipment Type")
        }
    }

    // Derived Linking Data
    const linkedEquipmentTypes = useMemo(() => {
        if (!currentTemplate) return []
        return equipmentTypes.filter(et => et.reverb_template_id === currentTemplate.id)
    }, [equipmentTypes, currentTemplate])

    const availableEquipmentTypes = useMemo(() => {
        if (!currentTemplate) return equipmentTypes
        // Available are those NOT linked to THIS template (they might be linked to others, but we allow restamping)
        return equipmentTypes.filter(et => et.reverb_template_id !== currentTemplate.id)
    }, [equipmentTypes, currentTemplate])

    return (
        <Box sx={{ p: 4, maxWidth: 1600, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">Reverb Templates</Typography>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    {currentTemplate && (
                        <>
                            <Button
                                variant="outlined"
                                startIcon={<InfoOutlinedIcon />}
                                onClick={handlePreview}
                            >
                                Preview CSV
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                href={reverbTemplatesApi.downloadCurrentTemplateUrl()}
                                target="_blank"
                            >
                                Download
                            </Button>
                        </>
                    )}
                    <Button
                        variant="contained"
                        component="label"
                        startIcon={<CloudUploadIcon />}
                    >
                        Upload Template
                        <input
                            type="file"
                            hidden
                            accept=".csv"
                            onChange={handleUpload}
                        />
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            {/* Template Status Card */}
            {currentTemplate && (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                Current Template: {currentTemplate.original_filename}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Uploaded: {new Date(currentTemplate.uploaded_at || "").toLocaleString()} |
                                Size: {(currentTemplate.file_size / 1024).toFixed(1)} KB
                            </Typography>
                        </Box>
                        <Box>
                            {fields.length === 0 ? (
                                <Alert severity="warning" action={
                                    <Button color="inherit" size="small" onClick={handleParse} disabled={parsing}>
                                        {parsing ? "Parsing..." : "Parse Now"}
                                    </Button>
                                }>
                                    Template uploaded but fields not parsed.
                                </Alert>
                            ) : (
                                <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
                                    Valid active template with {fields.length} fields configured.
                                </Alert>
                            )}
                        </Box>
                    </Box>

                    {parseSummary && (
                        <Alert severity="info" sx={{ mt: 2 }} onClose={() => setParseSummary(null)}>
                            Parse complete: {parseSummary.fields_inserted} fields found.
                        </Alert>
                    )}
                </Paper>
            )}

            {!currentTemplate && !loading && (
                <Paper sx={{ p: 6, textAlign: 'center', color: 'text.secondary', borderStyle: 'dashed' }}>
                    <Typography variant="h6">No Reverb template configured</Typography>
                    <Typography>Upload a Reverb CSV template file to get started.</Typography>
                </Paper>
            )}

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                    <CircularProgress />
                </Box>
            )}

            {/* Linked Equipment Types */}
            {currentTemplate && (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>Linked Equipment Types</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Models belonging to these Equipment Types will use this template for Reverb exports.
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <TextField
                            select
                            label="Select Equipment Type"
                            size="small"
                            sx={{ minWidth: 250 }}
                            value={linkEtId}
                            onChange={(e) => setLinkEtId(Number(e.target.value))}
                        >
                            <MenuItem value="">
                                <em>Select...</em>
                            </MenuItem>
                            {availableEquipmentTypes.map(et => (
                                <MenuItem key={et.id} value={et.id}>
                                    {et.name} {et.reverb_template_id ? "(Linked to other)" : ""}
                                </MenuItem>
                            ))}
                        </TextField>
                        <Button
                            variant="contained"
                            disabled={!linkEtId || linking}
                            onClick={handleLinkEquipmentType}
                        >
                            Link to Template
                        </Button>
                    </Box>

                    {linkedEquipmentTypes.length > 0 ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {linkedEquipmentTypes.map(et => (
                                <Chip
                                    key={et.id}
                                    label={et.name}
                                    onDelete={() => handleUnlinkEquipmentType(et.id)}
                                    color="secondary"
                                    variant="outlined"
                                />
                            ))}
                        </Box>
                    ) : (
                        <Alert severity="info" variant="outlined">
                            No Equipment Types linked to this template yet.
                        </Alert>
                    )}
                </Paper>
            )}

            {/* Fields Table */}
            {fields.length > 0 && (
                <Paper sx={{ width: '100%', mb: 2 }}>
                    <TableContainer sx={{ maxHeight: 800 }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Required</TableCell>
                                    <TableCell>Field Name (API)</TableCell>
                                    <TableCell>Display Name</TableCell>
                                    <TableCell>Fixed Value</TableCell>
                                    <TableCell>Allowed Values</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {fields.map((field) => {
                                    const hasValues = field.allowed_values && field.allowed_values.length > 0;
                                    const fixedVal = field.selected_value || field.custom_value;

                                    return (
                                        <TableRow
                                            key={field.id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => handleRowClick(field)}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Switch
                                                    size="small"
                                                    checked={field.required}
                                                    onChange={(e) => handleInlineRequiredToggle(field.id, e.target.checked)}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {field.field_name}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>{field.display_name}</TableCell>
                                            <TableCell>
                                                {fixedVal ? (
                                                    <Chip
                                                        label={fixedVal}
                                                        size="small"
                                                        color={field.custom_value ? "default" : "primary"}
                                                        variant={field.custom_value ? "outlined" : "filled"}
                                                    />
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary">-</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {hasValues ? (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {field.allowed_values.length} option(s) defined
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="caption" color="text.secondary">
                                                        Any
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton size="small">
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {/* Edit Modal */}
            <FieldDetailsModal
                open={isModalOpen}
                field={selectedField}
                equipmentTypes={equipmentTypes}
                onClose={() => setIsModalOpen(false)}
                onFieldUpdated={(updated) => {
                    setFields(prev => prev.map(f => f.id === updated.id ? updated : f))
                    setSelectedField(updated)
                }}
            />

            {/* Preview Modal */}
            <Dialog
                open={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                maxWidth="xl"
                fullWidth
            >
                <DialogTitle>
                    Template Preview
                    {previewData && (
                        <Typography variant="caption" display="block">
                            {previewData.original_filename} ({previewData.preview_row_count} rows shown)
                        </Typography>
                    )}
                </DialogTitle>
                <DialogContent dividers>
                    {loadingPreview ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : previewData ? (
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
                            <Table size="small" stickyHeader>
                                <TableBody>
                                    {previewData.grid.map((row, rIdx) => (
                                        <TableRow key={rIdx}>
                                            <TableCell
                                                component="th"
                                                scope="row"
                                                variant="head"
                                                sx={{
                                                    width: 40,
                                                    bgcolor: 'grey.100',
                                                    color: 'text.secondary',
                                                    userSelect: 'none'
                                                }}
                                            >
                                                {rIdx + 1}
                                            </TableCell>
                                            {row.map((cell, cIdx) => (
                                                <TableCell
                                                    key={cIdx}
                                                    sx={{
                                                        whiteSpace: 'nowrap',
                                                        maxWidth: 200,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                >
                                                    {cell}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography color="error">Failed to load preview</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}
