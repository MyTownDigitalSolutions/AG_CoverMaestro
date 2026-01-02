import React, { useState, useEffect, useMemo } from 'react'
import {
    Box, Typography, Paper, Button, Alert, CircularProgress,
    Divider, IconButton, Tooltip, Table, TableBody, TableCell,
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
    EbayFieldResponse
} from '../services/api'

// --- Component: Valid Values Section in Modal ---
const ValidValuesSection = ({ values }: { values: string[] }) => {
    const [searchTerm, setSearchTerm] = useState('')

    const filteredValues = useMemo(() => {
        if (!values) return []
        if (!searchTerm) return values
        return values.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()))
    }, [values, searchTerm])

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
                {values && values.length > 0 ? (
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                        {filteredValues.map((v, idx) => (
                            <Chip
                                key={idx}
                                label={v}
                                size="small"
                                variant="outlined"
                                onClick={() => { }} // No-op, just consistent styling
                                sx={{ cursor: 'not-allowed' }} // Indicate read-only
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

            {/* Read-Only Add Area */}
            <Stack direction="row" spacing={1}>
                <TextField
                    size="small"
                    placeholder="Add new value..."
                    disabled
                    fullWidth
                    helperText="Changing defaults requires backend support (Phase 3)"
                />
                <Button variant="contained" disabled startIcon={<AddIcon />}>
                    Add
                </Button>
            </Stack>
        </Box>
    )
}

// --- Component: Field Details Modal ---
const FieldDetailsModal = ({ open, field, onClose }: { open: boolean, field: EbayFieldResponse | null, onClose: () => void }) => {
    if (!field) return null

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{field.field_name}</Typography>
                    <IconButton size="small" onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
                <Typography variant="caption" color="text.secondary">
                    Order Index: {field.order_index} | ID: {field.id}
                </Typography>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={3}>
                    {/* Required Toggle */}
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch checked={field.required} disabled />
                            }
                            label="Required"
                        />
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ ml: 4 }}>
                            Editing requires backend support (coming in Phase 3)
                        </Typography>
                    </Box>

                    {/* Default Value */}
                    <TextField
                        label="Default / Selected Value"
                        fullWidth
                        value={field.selected_value || "Any"}
                        InputProps={{ readOnly: true }}
                        disabled // Visually distinct as read-only
                        helperText="Editing requires backend support (coming in Phase 3)"
                    />

                    {/* Valid Values */}
                    <ValidValuesSection values={field.allowed_values} />
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
                                            <Switch checked={field.required} disabled size="small" />
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="body2">
                                                    {field.selected_value || "Any"}
                                                </Typography>
                                                {field.allowed_values && field.allowed_values.length > 0 && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        ({field.allowed_values.length})
                                                    </Typography>
                                                )}
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
            />
        </Box>
    )
}
