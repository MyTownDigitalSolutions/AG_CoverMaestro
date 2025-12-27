import { useEffect, useState, useRef } from 'react'
import { useSearchParams, Link as RouterLink } from 'react-router-dom'
import {
  Box, Typography, Paper, Button, TextField, Grid, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Alert, CircularProgress, FormControl, InputLabel, Select, MenuItem, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Accordion, AccordionSummary, AccordionDetails, Switch
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LinkIcon from '@mui/icons-material/Link'
import AddIcon from '@mui/icons-material/Add'
import PreviewIcon from '@mui/icons-material/Preview'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import { templatesApi, equipmentTypesApi, settingsApi, type EquipmentTypeProductTypeLink, type AmazonProductTypeTemplatePreviewResponse, type AmazonCustomizationTemplatePreviewResponse } from '../services/api'
import type { AmazonProductType, EquipmentType, ProductTypeField, AmazonCustomizationTemplate } from '../types'
import FieldDetailsDialog from '../components/FieldDetailsDialog'

const rowStyles: Record<number, React.CSSProperties> = {
  0: { backgroundColor: '#1976d2', color: 'white', fontWeight: 'bold', fontSize: '11px' },
  1: { backgroundColor: '#2196f3', color: 'white', fontSize: '11px' },
  2: { backgroundColor: '#4caf50', color: 'white', fontWeight: 'bold', fontSize: '11px' },
  3: { backgroundColor: '#8bc34a', color: 'black', fontWeight: 'bold', fontSize: '11px' },
  4: { backgroundColor: '#c8e6c9', color: 'black', fontSize: '10px' },
  5: { backgroundColor: '#fff9c4', color: 'black', fontStyle: 'italic', fontSize: '10px' },
}

interface TemplatePreviewProps {
  template: AmazonProductType
  onClose: () => void
}

function TemplatePreview({ template, onClose }: TemplatePreviewProps) {
  const headerRows = template.header_rows || []
  const maxCols = Math.max(...headerRows.map(r => r?.length || 0), template.fields?.length || 0)

  if (headerRows.length === 0) {
    return (
      <Dialog open onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Template Preview - {template.code}</DialogTitle>
        <DialogContent>
          <Alert severity="warning">No header rows available for this template. Try re-importing the template.</Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={onClose} maxWidth={false} fullWidth PaperProps={{ sx: { maxWidth: '95vw', height: '80vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Amazon Export Template Preview - {template.code}</span>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
          <Table size="small" sx={{ minWidth: maxCols * 140, tableLayout: 'fixed' }}>
            <TableBody>
              {headerRows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {Array.from({ length: maxCols }).map((_, colIdx) => (
                    <TableCell
                      key={colIdx}
                      sx={{
                        ...rowStyles[rowIdx],
                        border: '1px solid #ccc',
                        padding: '4px 8px',
                        width: 140,
                        minWidth: 140,
                        maxWidth: 140,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row?.[colIdx] || ''}
                    >
                      {row?.[colIdx] || ''}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ p: 2, borderTop: '1px solid #ccc', backgroundColor: '#f5f5f5' }}>
          <Typography variant="body2" color="text.secondary">
            This preview shows the first 6 rows of the Amazon export template. Row 6 contains example data.
            The actual export will include your product data starting from row 7.
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  )
}


interface ProductTypeFilePreviewProps {
  open: boolean
  onClose: () => void
  loading: boolean
  error: string | null
  data: AmazonProductTypeTemplatePreviewResponse | null
}

function ProductTypeFilePreview({ open, onClose, loading, error, data }: ProductTypeFilePreviewProps) {
  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} fullWidth PaperProps={{ sx: { maxWidth: '95vw', height: '80vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          Product Type File Preview
          {data && <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>{data.original_filename} ({data.sheet_name})</Typography>}
        </span>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 4 }}>
            <Alert severity="error">
              <Typography variant="subtitle1" gutterBottom>Failed to load preview</Typography>
              {error}
            </Alert>
          </Box>
        )}

        {data && !loading && (
          <>
            <Box sx={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
              <Table size="small" sx={{ minWidth: 600, borderCollapse: 'collapse' }}>
                <TableBody>
                  {data.grid.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      <TableCell
                        component="th"
                        variant="head"
                        sx={{
                          width: 40,
                          backgroundColor: '#f5f5f5',
                          borderRight: '1px solid #ddd',
                          textAlign: 'center',
                          color: '#888',
                          fontSize: '11px',
                          p: '4px'
                        }}
                      >
                        {rowIndex + 1}
                      </TableCell>
                      {row.map((cell, colIndex) => (
                        <TableCell
                          key={colIndex}
                          sx={{
                            border: '1px solid #e0e0e0',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '12px',
                            p: '4px 8px'
                          }}
                          title={cell}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Box sx={{ p: 1, borderTop: '1px solid #ccc', backgroundColor: '#f9f9f9', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                Original Sheet Dimensions: {data.max_row} rows x {data.max_column} columns
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Preview limited to first {data.preview_row_count} rows x {data.preview_column_count} columns
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface CustomizationTemplateFilePreviewProps {
  open: boolean
  onClose: () => void
  loading: boolean
  error: string | null
  data: AmazonCustomizationTemplatePreviewResponse | null
}

function CustomizationTemplateFilePreview({ open, onClose, loading, error, data }: CustomizationTemplateFilePreviewProps) {
  if (!open) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth={false} fullWidth PaperProps={{ sx: { maxWidth: '95vw', height: '80vh' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>
          Customization Template Preview
          {data && <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>{data.original_filename} ({data.sheet_name})</Typography>}
        </span>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box sx={{ p: 4 }}>
            <Alert severity="error">
              <Typography variant="subtitle1" gutterBottom>Failed to load preview</Typography>
              {error}
            </Alert>
          </Box>
        )}

        {data && !loading && (
          <>
            <Box sx={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(80vh - 100px)' }}>
              <Table size="small" sx={{ minWidth: 600, borderCollapse: 'collapse' }}>
                <TableBody>
                  {data.grid.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      <TableCell
                        component="th"
                        variant="head"
                        sx={{
                          width: 40,
                          backgroundColor: '#f5f5f5',
                          borderRight: '1px solid #ddd',
                          textAlign: 'center',
                          color: '#888',
                          fontSize: '11px',
                          p: '4px'
                        }}
                      >
                        {rowIndex + 1}
                      </TableCell>
                      {row.map((cell, colIndex) => (
                        <TableCell
                          key={colIndex}
                          sx={{
                            border: '1px solid #e0e0e0',
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '12px',
                            p: '4px 8px'
                          }}
                          title={cell}
                        >
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Box sx={{ p: 1, borderTop: '1px solid #ccc', backgroundColor: '#f9f9f9', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                Original Sheet Dimensions: {data.max_row} rows x {data.max_column} columns
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Preview limited to first {data.preview_row_count} rows x {data.preview_column_count} columns
              </Typography>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const checkFileMatch = (filename: string, productCode: string): 'match' | 'mismatch' => {
  const normalizedFilename = normalizeText(filename)
  const normalizedCode = normalizeText(productCode)

  if (normalizedFilename.includes(normalizedCode) || normalizedCode.includes(normalizedFilename)) {
    return 'match'
  }

  const codeWords = productCode.toLowerCase().split(/[_\s&]+/).filter(w => w.length > 2)
  const matchingWords = codeWords.filter(word => normalizedFilename.includes(word))

  if (matchingWords.length >= Math.ceil(codeWords.length / 2)) {
    return 'match'
  }

  return 'mismatch'
}

interface PendingUpload {
  file: File
  productCode: string
  isUpdate: boolean
  matchStatus: 'match' | 'mismatch'
}

export default function TemplatesPage() {
  // Existing state for Product Types
  const [productTypeTemplates, setProductTypeTemplates] = useState<AmazonProductType[]>([])

  // New state for Customization
  const [customizationTemplates, setCustomizationTemplates] = useState<AmazonCustomizationTemplate[]>([])

  // Product Type File Preview State
  const [isPtPreviewOpen, setIsPtPreviewOpen] = useState(false)
  const [ptPreviewLoading, setPtPreviewLoading] = useState(false)
  const [ptPreviewError, setPtPreviewError] = useState<string | null>(null)
  const [ptPreviewData, setPtPreviewData] = useState<AmazonProductTypeTemplatePreviewResponse | null>(null)

  // UI State
  const [templateType, setTemplateType] = useState<'product' | 'customization'>('product')
  const [selectedTemplate, setSelectedTemplate] = useState<AmazonProductType | AmazonCustomizationTemplate | null>(null)

  // Navigation State
  const [searchParams] = useSearchParams()
  const customLinkingRef = useRef<HTMLDivElement>(null)

  // Upload State
  const [productCode, setProductCode] = useState('')
  const [selectedExistingCode, setSelectedExistingCode] = useState('')
  const [selectedCustomizationId, setSelectedCustomizationId] = useState<number | ''>('')

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Product Type Upload Confirmation
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null)

  // Customization Template Preview State
  const [isCustPreviewOpen, setIsCustPreviewOpen] = useState(false)
  const [custPreviewLoading, setCustPreviewLoading] = useState(false)
  const [custPreviewError, setCustPreviewError] = useState<string | null>(null)
  const [custPreviewData, setCustPreviewData] = useState<AmazonCustomizationTemplatePreviewResponse | null>(null)

  // Linking State
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [equipmentTypeLinks, setEquipmentTypeLinks] = useState<EquipmentTypeProductTypeLink[]>([]) // For Product Types

  const [ptLinkEquipId, setPtLinkEquipId] = useState<number | ''>('')
  const [ptLinkTemplateId, setPtLinkTemplateId] = useState<number | ''>('')

  const [custLinkEquipId, setCustLinkEquipId] = useState<number | ''>('')
  const [custLinkTemplateId, setCustLinkTemplateId] = useState<number | ''>('')

  const [showPreview, setShowPreview] = useState(false)
  const [selectedField, setSelectedField] = useState<ProductTypeField | null>(null)
  const [showOnlyRequired, setShowOnlyRequired] = useState(false)

  // Export Override State
  const [overrideSheetName, setOverrideSheetName] = useState('')
  const [overrideStartRow, setOverrideStartRow] = useState('')
  const [overrideSaving, setOverrideSaving] = useState(false)

  useEffect(() => {
    if (selectedTemplate && templateType === 'product') {
      const pt = selectedTemplate as AmazonProductType
      setOverrideSheetName(pt.export_sheet_name_override || '')
      setOverrideStartRow(pt.export_start_row_override?.toString() || '')
    }
  }, [selectedTemplate, templateType])

  const handleSaveOverrides = async () => {
    if (!selectedTemplate || templateType !== 'product') return
    setOverrideSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const pt = selectedTemplate as AmazonProductType
      // If empty string, send null
      const startRow = overrideStartRow.trim() ? parseInt(overrideStartRow.trim()) : null
      const sheetName = overrideSheetName.trim() || null

      const updated = await templatesApi.updateExportConfig(pt.code, {
        export_sheet_name_override: sheetName,
        export_start_row_override: startRow
      })

      setSelectedTemplate(updated)
      setProductTypeTemplates(prev => prev.map(p => p.id === updated.id ? updated : p))
      setSuccess('Export overrides saved successfully')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to save export overrides')
    } finally {
      setOverrideSaving(false)
    }
  }

  const handleClearOverrides = async () => {
    if (!selectedTemplate || templateType !== 'product') return
    setOverrideSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const pt = selectedTemplate as AmazonProductType
      const updated = await templatesApi.updateExportConfig(pt.code, {
        export_sheet_name_override: null,
        export_start_row_override: null
      })

      setSelectedTemplate(updated)
      setProductTypeTemplates(prev => prev.map(p => p.id === updated.id ? updated : p))
      setOverrideSheetName('')
      setOverrideStartRow('')
      setSuccess('Export overrides cleared')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to clear export overrides')
    } finally {
      setOverrideSaving(false)
    }
  }

  const loadData = async () => {
    const [pts, custs, ets, links] = await Promise.all([
      templatesApi.list(),
      settingsApi.listAmazonCustomizationTemplates(),
      equipmentTypesApi.list(),
      templatesApi.listEquipmentTypeLinks()
    ])
    setProductTypeTemplates(pts)
    setCustomizationTemplates(custs)
    setEquipmentTypes(ets)
    setEquipmentTypeLinks(links)
  }

  useEffect(() => {
    loadData()
  }, [])

  // Handle Query Params for Auto-Focus
  useEffect(() => {
    const focus = searchParams.get('focus')
    const scroll = searchParams.get('scroll')

    if (focus === 'customization') {
      setTemplateType('customization')
    }

    if (scroll === 'linking') {
      // Small delay to ensure render is settled
      setTimeout(() => {
        customLinkingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [searchParams])

  const isFixMissingFlow = searchParams.get('focus') === 'customization' && searchParams.get('scroll') === 'linking'

  // --- Handlers: Product Type Upload ---
  const handleProductTypeFileSelect = (event: React.ChangeEvent<HTMLInputElement>, isUpdate: boolean) => {
    const file = event.target.files?.[0]
    const codeToUse = isUpdate ? selectedExistingCode : productCode

    setFileInputRef(event.target)

    if (!file || !codeToUse) {
      setError(isUpdate ? 'Please select a Product Type to update' : 'Please enter a product code before uploading')
      return
    }

    const matchStatus = checkFileMatch(file.name, codeToUse)

    setPendingUpload({
      file,
      productCode: codeToUse,
      isUpdate,
      matchStatus
    })
  }

  const handleConfirmProductTypeUpload = async () => {
    if (!pendingUpload) return
    setUploading(true)
    setError(null)
    setSuccess(null)
    setPendingUpload(null)

    try {
      const result = await templatesApi.import(pendingUpload.file, pendingUpload.productCode)
      const action = pendingUpload.isUpdate ? 'Updated' : 'Imported'
      setSuccess(`${action} ${result.fields_imported} fields, ${result.keywords_imported} keywords, ${result.valid_values_imported} valid values`)
      setProductCode('')
      setSelectedExistingCode('')
      loadData()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to import template')
    } finally {
      setUploading(false)
      if (fileInputRef) fileInputRef.value = ''
    }
  }

  const handleCancelProductTypeUpload = () => {
    setPendingUpload(null)
    if (fileInputRef) fileInputRef.value = ''
  }

  // --- Handlers: Customization Upload ---
  const handleCustomizationFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, isUpdate: boolean) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      if (isUpdate) {
        if (!selectedCustomizationId) {
          setError("No template selected for update")
          return
        }
        await settingsApi.updateAmazonCustomizationTemplate(selectedCustomizationId as number, file)
        setSuccess('Customization template updated successfully')
        setSelectedCustomizationId('')
        setSelectedTemplate(null)
      } else {
        await settingsApi.uploadAmazonCustomizationTemplate(file)
        setSuccess('Customization template uploaded successfully')
      }
      loadData()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to upload customization template')
    } finally {
      setUploading(false)
      event.target.value = '' // Reset input
    }
  }

  const handlePreviewCustomizationTemplate = async (templateId: number) => {
    setIsCustPreviewOpen(true)
    setCustPreviewLoading(true)
    setCustPreviewError(null)
    setCustPreviewData(null)

    try {
      const data = await settingsApi.previewCustomizationTemplate(templateId)
      setCustPreviewData(data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setCustPreviewError(err.response?.data?.detail || 'Failed to load preview')
    } finally {
      setCustPreviewLoading(false)
    }
  }

  // --- Handlers: Deletion ---
  const handleDeleteProductType = async (code: string) => {
    if (confirm('Are you sure you want to delete this Product Type template?')) {
      await templatesApi.delete(code)
      loadData()
      if ((selectedTemplate as AmazonProductType)?.code === code) {
        setSelectedTemplate(null)
      }
    }
  }

  const handleDeleteCustomization = async (id: number) => {
    if (confirm('Are you sure you want to delete this Customization template?')) {
      await settingsApi.deleteAmazonCustomizationTemplate(id)
      loadData()
      if ((selectedTemplate as AmazonCustomizationTemplate)?.id === id) {
        setSelectedTemplate(null)
      }
    }
  }

  // --- Handlers: Linking ---
  const handleCreateProductTypeLink = async () => {
    if (ptLinkEquipId === '' || ptLinkTemplateId === '') {
      setError('Please select both an Equipment Type and a Product Type')
      return
    }
    try {
      await templatesApi.createEquipmentTypeLink(ptLinkEquipId as number, ptLinkTemplateId as number)
      setSuccess('Equipment Type linked to Product Type successfully')
      setPtLinkEquipId('')
      setPtLinkTemplateId('')
      loadData()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to create link')
    }
  }

  const handleDeleteProductTypeLink = async (linkId: number) => {
    try {
      await templatesApi.deleteEquipmentTypeLink(linkId)
      loadData()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to delete link')
    }
  }

  const handleCreateCustomizationLink = async () => {
    if (custLinkEquipId === '' || custLinkTemplateId === '') {
      setError('Please select both an Equipment Type and a Customization Template')
      return
    }

    try {
      await settingsApi.assignAmazonCustomizationTemplate(custLinkEquipId as number, custLinkTemplateId as number)
      setSuccess('Equipment Type linked to Customization Template successfully')
      setCustLinkEquipId('')
      setCustLinkTemplateId('')
      loadData()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to link customization template')
    }
  }

  const getEquipmentTypeName = (id: number) => {
    const et = equipmentTypes.find(e => e.id === id)
    return et?.name || `ID: ${id}`
  }

  const getProductTypeCode = (id: number) => {
    const pt = productTypeTemplates.find(t => t.id === id)
    return pt?.code || `ID: ${id}`
  }

  const getCustomizationName = (id: number) => {
    const ct = customizationTemplates.find(c => c.id === id)
    return ct?.original_filename || `ID: ${id}`
  }

  const handlePreviewProductType = async (code: string) => {
    setIsPtPreviewOpen(true)
    setPtPreviewLoading(true)
    setPtPreviewError(null)
    setPtPreviewData(null)

    try {
      const data = await templatesApi.previewProductTypeTemplate(code)
      setPtPreviewData(data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setPtPreviewError(err.response?.data?.detail || 'Failed to load preview. Ensure the file exists on the server.')
    } finally {
      setPtPreviewLoading(false)
    }
  }

  const handleClosePtPreview = () => {
    setIsPtPreviewOpen(false)
    setPtPreviewData(null)
    setPtPreviewError(null)
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Amazon Templates</Typography>

      {isFixMissingFlow && (
        <Paper
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: '#e3f2fd',
            border: '1px solid #90caf9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Box>
            <Typography variant="subtitle1" component="div" sx={{ fontWeight: 'bold', color: '#0d47a1' }}>
              Assign missing customization templates below.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Once complete, return to the Export page to generate your files.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button component={RouterLink} to="/templates" variant="text" size="small">
              Clear Focus
            </Button>
            <Button component={RouterLink} to="/export" variant="contained" color="primary">
              Back to Amazon Export
            </Button>
          </Box>
        </Paper>
      )}

      {/* Main Action Card: Import/Update */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Import New Template</Typography>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Template Type</InputLabel>
            <Select
              value={templateType}
              label="Template Type"
              onChange={(e) => setTemplateType(e.target.value as 'product' | 'customization')}
            >
              <MenuItem value="product">Product Type Template</MenuItem>
              <MenuItem value="customization">Customization Template</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {templateType === 'product' ? (
          // PRODUCT TYPE IMPORT UI
          <>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Product Type Code"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="e.g., CARRIER_BAG_CASE"
                  helperText="Enter the product type code for this template"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={uploading ? <CircularProgress size={20} /> : <UploadFileIcon />}
                  disabled={uploading || !productCode}
                >
                  Upload New Product Type
                  <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleProductTypeFileSelect(e, false)} />
                </Button>
              </Grid>
            </Grid>

            {productTypeTemplates.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" gutterBottom>Update Existing Product Type</Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Select Product Type</InputLabel>
                      <Select
                        value={selectedExistingCode}
                        label="Select Product Type"
                        onChange={(e) => setSelectedExistingCode(e.target.value)}
                      >
                        {productTypeTemplates.map((t) => (
                          <MenuItem key={t.id} value={t.code}>{t.code}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button
                      variant="outlined"
                      component="label"
                      color="warning"
                      startIcon={uploading ? <CircularProgress size={20} /> : <RefreshIcon />}
                      disabled={uploading || !selectedExistingCode}
                    >
                      Upload Updated Template
                      <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleProductTypeFileSelect(e, true)} />
                    </Button>
                  </Grid>
                </Grid>
              </>
            )}
          </>
        ) : (
          // CUSTOMIZATION IMPORT UI
          <>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <Button
                  variant="contained"
                  component="label"
                  startIcon={uploading ? <CircularProgress size={20} /> : <UploadFileIcon />}
                  disabled={uploading}
                >
                  Upload New Customization Template
                  <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleCustomizationFileSelect(e, false)} />
                </Button>
              </Grid>
            </Grid>

            {customizationTemplates.length > 0 && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="h6" gutterBottom>Update Existing Customization Template</Typography>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth>
                      <InputLabel>Select Customization Template</InputLabel>
                      <Select
                        value={selectedCustomizationId}
                        label="Select Customization Template"
                        onChange={(e) => setSelectedCustomizationId(e.target.value as number)}
                      >
                        {customizationTemplates.map((t) => (
                          <MenuItem key={t.id} value={t.id}>{t.original_filename}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Button
                      variant="outlined"
                      component="label"
                      color="warning"
                      startIcon={uploading ? <CircularProgress size={20} /> : <RefreshIcon />}
                      disabled={uploading || selectedCustomizationId === ''}
                    >
                      Upload Updated File
                      <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleCustomizationFileSelect(e, true)} />
                    </Button>
                  </Grid>
                </Grid>
              </>
            )}
          </>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      </Paper>

      {/* Linking Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkIcon /> Template Linking
        </Typography>

        {/* Product Type Links */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold', }} gutterBottom>Product Type Templates (for regular listing data)</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.85 }}>
            We store the original Amazon XLSX and extract fields for defaults. Preview/Download uses the stored file.
          </Typography>

          {/* ✅ UI CHANGE: Template dropdown first, then Equipment Type */}
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Product Type Template</InputLabel>
                <Select
                  value={ptLinkTemplateId}
                  label="Product Type Template"
                  onChange={(e) => setPtLinkTemplateId(e.target.value as number)}
                >
                  {productTypeTemplates.map((t) => (
                    <MenuItem key={t.id} value={t.id}>{t.code}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Equipment Type</InputLabel>
                <Select
                  value={ptLinkEquipId}
                  label="Equipment Type"
                  onChange={(e) => setPtLinkEquipId(e.target.value as number)}
                >
                  {equipmentTypes.map((et) => (
                    <MenuItem key={et.id} value={et.id}>{et.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateProductTypeLink} disabled={ptLinkEquipId === '' || ptLinkTemplateId === ''}>
                Link Product Type
              </Button>
            </Grid>
          </Grid>

          {equipmentTypeLinks.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead><TableRow><TableCell>Template</TableCell><TableCell>Equipment Type</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
                <TableBody>
                  {equipmentTypeLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>{getProductTypeCode(link.product_type_id)}</TableCell>
                      <TableCell>{getEquipmentTypeName(link.equipment_type_id)}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleDeleteProductTypeLink(link.id)}><DeleteIcon /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        <Divider />

        {/* Customization Links */}
        <Box sx={{ mt: 3 }} ref={customLinkingRef} style={{ scrollMarginTop: '80px' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>Customization Templates (for customization.txt)</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, opacity: 0.85 }}>
            We store the original Amazon XLSX. In XLSX export mode, the file is included byte-for-byte.
          </Typography>
          <Typography variant="caption" color="text.secondary" paragraph>
            Note: This assigns the template to the Equipment Type directly. Re-assign to change.
          </Typography>

          {/* ✅ UI CHANGE: Template dropdown first, then Equipment Type */}
          <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Customization Template</InputLabel>
                <Select
                  value={custLinkTemplateId}
                  label="Customization Template"
                  onChange={(e) => setCustLinkTemplateId(e.target.value as number)}
                >
                  {customizationTemplates.map((t) => (
                    <MenuItem key={t.id} value={t.id}>{t.original_filename}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Equipment Type</InputLabel>
                <Select
                  value={custLinkEquipId}
                  label="Equipment Type"
                  onChange={(e) => setCustLinkEquipId(e.target.value as number)}
                >
                  {equipmentTypes.map((et) => (
                    <MenuItem key={et.id} value={et.id}>{et.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={4}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateCustomizationLink} disabled={custLinkEquipId === '' || custLinkTemplateId === ''}>
                Assign Template
              </Button>
            </Grid>
          </Grid>

          <TableContainer>
            <Table size="small">
              <TableHead><TableRow><TableCell>Assigned Template</TableCell><TableCell>Equipment Type</TableCell></TableRow></TableHead>
              <TableBody>
                {equipmentTypes.filter(et => et.amazon_customization_template_id).map((et) => (
                  <TableRow key={et.id}>
                    <TableCell>
                      {getCustomizationName(et.amazon_customization_template_id!)}
                    </TableCell>
                    <TableCell>{et.name}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>

      <Dialog open={pendingUpload !== null} onClose={handleCancelProductTypeUpload}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {pendingUpload?.matchStatus === 'match' ? <CheckCircleIcon color="success" /> : <WarningIcon color="warning" />}
          {pendingUpload?.matchStatus === 'match' ? 'Confirm Upload' : 'File Mismatch Warning'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingUpload?.matchStatus === 'match' ? (
              <>File <strong>{pendingUpload?.file.name}</strong> matches Product Type <strong>{pendingUpload?.productCode}</strong>. Proceed?</>
            ) : (
              <>File <strong>{pendingUpload?.file.name}</strong> does not match Product Type <strong>{pendingUpload?.productCode}</strong>. Use anyway?</>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelProductTypeUpload}>Cancel</Button>
          <Button onClick={handleConfirmProductTypeUpload} variant="contained" color={pendingUpload?.matchStatus === 'match' ? 'primary' : 'warning'}>
            {pendingUpload?.matchStatus === 'match' ? 'Proceed' : 'Yes, Use This File'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Product Type File Preview Modal */}
      <ProductTypeFilePreview
        open={isPtPreviewOpen}
        onClose={handleClosePtPreview}
        loading={ptPreviewLoading}
        error={ptPreviewError}
        data={ptPreviewData}
      />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Imported Templates</Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.8 }}>
              Preview is capped to 50×50 for performance.
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name / Code</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Info</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productTypeTemplates.map(pt => (
                    <TableRow key={`pt-${pt.id}`} hover selected={(selectedTemplate as AmazonProductType)?.code === pt.code} onClick={() => { setSelectedTemplate(pt); setTemplateType('product') }} sx={{ cursor: 'pointer' }}>
                      <TableCell>{pt.code}</TableCell>
                      <TableCell><Chip label="Product Type" size="small" color="primary" variant="outlined" /></TableCell>
                      <TableCell>{pt.fields?.length || 0} fields</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteProductType(pt.code); }}><DeleteIcon /></IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePreviewProductType(pt.code); }} title="Preview Original File"><PreviewIcon /></IconButton>
                        <IconButton size="small" component="a" href={templatesApi.downloadProductTypeTemplateUrl(pt.code)} download target="_blank" onClick={(e) => e.stopPropagation()} title="Download Original File"><DownloadIcon /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {customizationTemplates.map(ct => (
                    <TableRow key={`ct-${ct.id}`} hover selected={(selectedTemplate as AmazonCustomizationTemplate)?.id === ct.id} onClick={() => { setSelectedTemplate(ct); setTemplateType('customization') }} sx={{ cursor: 'pointer' }}>
                      <TableCell>{ct.original_filename}</TableCell>
                      <TableCell><Chip label="Customization" size="small" color="secondary" variant="outlined" /></TableCell>
                      <TableCell>{Math.round(ct.file_size / 1024)} KB</TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setTemplateType('customization'); setSelectedTemplate(ct); handlePreviewCustomizationTemplate(ct.id); }}
                          title="Preview File"
                          sx={{ mr: 1 }}
                        >
                          <PreviewIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          component="a"
                          href={settingsApi.downloadAmazonCustomizationTemplateUrl(ct.id)}
                          download
                          onClick={(e) => e.stopPropagation()}
                          title="Download Original"
                          sx={{ mr: 1 }}
                        >
                          <DownloadIcon />
                        </IconButton>
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteCustomization(ct.id); }} title="Delete">
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          {selectedTemplate && (
            <Paper sx={{ p: 2 }}>
              {templateType === 'product' ? (
                // PRODUCT TYPE DETAILS (Existing Logic)
                <>
                  {/* Export Overrides Section */}
                  <Accordion defaultExpanded={(selectedTemplate as AmazonProductType).export_sheet_name_override || (selectedTemplate as AmazonProductType).export_start_row_override ? true : false} sx={{ mb: 2, border: '1px solid #e0e0e0', boxShadow: 'none' }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ backgroundColor: '#fff8e1' }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarningIcon fontSize="small" color="warning" /> Export Overrides (Fallback)
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        Only use these settings if the automatic export fails to detect the correct sheet or start row.
                      </Typography>
                      <Grid container spacing={2} alignItems="flex-start">
                        <Grid item xs={12} md={5}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Export Sheet Name"
                            value={overrideSheetName}
                            onChange={(e) => setOverrideSheetName(e.target.value)}
                            helperText="Optional. If the export sheet isn't named 'Template', enter the exact sheet name here."
                          />
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Export Start Row"
                            type="number"
                            value={overrideStartRow}
                            onChange={(e) => setOverrideStartRow(e.target.value)}
                            helperText="Optional. Forces the first write row."
                            InputProps={{ inputProps: { min: 1 } }}
                          />
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSaveOverrides}
                            disabled={overrideSaving}
                          >
                            Save Overrides
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={handleClearOverrides}
                            disabled={overrideSaving}
                          >
                            Clear
                          </Button>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Template Fields - {(selectedTemplate as AmazonProductType).code}</Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Switch size="small" checked={showOnlyRequired} onChange={(e) => setShowOnlyRequired(e.target.checked)} />
                        <Typography variant="body2">Required Only</Typography>
                      </Box>
                      <Button variant="outlined" size="small" startIcon={<PreviewIcon />} onClick={() => setShowPreview(true)}>Preview Export</Button>
                    </Box>
                  </Box>

                  <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
                    {/* Render fields logic reused from before */}
                    {(() => {
                      const pt = selectedTemplate as AmazonProductType
                      const allFields = pt.fields || []
                      const filteredFields = showOnlyRequired ? allFields.filter(f => f.required) : allFields
                      const groupedFields = filteredFields.reduce((acc, field) => {
                        const group = field.attribute_group || 'Other'
                        if (!acc[group]) acc[group] = []
                        acc[group].push(field)
                        return acc
                      }, {} as Record<string, typeof pt.fields>)
                      const groups = Object.keys(groupedFields || {})

                      const handleToggleGroupRequired = async (groupName: string, setRequired: boolean) => {
                        const groupFields = groupedFields![groupName] || []
                        // Optimistic update locally first? No, let's do it safely.
                        // Actually, we should probably do parallel requests or a bulk endpoint.
                        // Existing pattern was loop.
                        for (const field of groupFields) {
                          if (field.required !== setRequired) {
                            try {
                              await templatesApi.updateField(field.id, { required: setRequired })
                            } catch (err) {
                              console.error('Failed to update field', err)
                            }
                          }
                        }

                        // Update UI
                        const currentPt = selectedTemplate as AmazonProductType
                        const updatedFields = currentPt.fields.map(f => {
                          const inGroup = groupFields.some(gf => gf.id === f.id)
                          return inGroup ? { ...f, required: setRequired } : f
                        })

                        const updatedPt = { ...currentPt, fields: updatedFields }
                        setSelectedTemplate(updatedPt)
                        setProductTypeTemplates(prev => prev.map(t => t.id === updatedPt.id ? updatedPt : t))
                      }

                      return groups.map((groupName) => {
                        const groupFields = groupedFields![groupName] || []
                        const allRequired = groupFields.every(f => f.required)
                        const noneRequired = groupFields.every(f => !f.required)

                        return (
                          <Accordion key={groupName} defaultExpanded={false} sx={{ '&:before': { display: 'none' } }}>
                            <AccordionSummary
                              expandIcon={<ExpandMoreIcon />}
                              sx={{
                                backgroundColor: 'action.hover',
                                '&:hover': { backgroundColor: 'action.selected' }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'medium', flexGrow: 1 }}>
                                  {groupName} ({groupFields.length})
                                </Typography>
                                <Chip
                                  label={`${groupFields.filter(f => f.required).length} req`}
                                  size="small"
                                  color={allRequired ? 'primary' : noneRequired ? 'default' : 'warning'}
                                  sx={{ fontSize: '10px', height: 20 }}
                                />
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0 }}>
                              <Box sx={{ display: 'flex', gap: 1, p: 1, backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleToggleGroupRequired(groupName, true)}
                                  disabled={allRequired}
                                >
                                  Mark All Required
                                </Button>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => handleToggleGroupRequired(groupName, false)}
                                  disabled={noneRequired}
                                >
                                  Clear All Required
                                </Button>
                              </Box>
                              <Table size="small">
                                <TableHead><TableRow><TableCell>Field Name</TableCell><TableCell width={80}>Required</TableCell><TableCell>Default / Selected Value</TableCell></TableRow></TableHead>
                                <TableBody>
                                  {groupFields.map(field => (
                                    <TableRow key={field.id} hover sx={{ cursor: 'pointer' }} onClick={() => setSelectedField(field)}>
                                      <TableCell>{field.field_name}</TableCell>
                                      <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Switch
                                          size="small"
                                          checked={field.required}
                                          onChange={async (e) => {
                                            const newRequired = e.target.checked
                                            try {
                                              const updated = await templatesApi.updateField(field.id, { required: newRequired })
                                              const updatedField = { ...field, required: updated.required }
                                              setSelectedTemplate({
                                                ...selectedTemplate,
                                                fields: (selectedTemplate as AmazonProductType).fields.map(f =>
                                                  f.id === field.id ? updatedField : f
                                                )
                                              })
                                              setProductTypeTemplates(prev => prev.map(t =>
                                                t.id === (selectedTemplate as AmazonProductType).id
                                                  ? { ...t, fields: t.fields.map(f => f.id === field.id ? updatedField : f) }
                                                  : t
                                              ))
                                            } catch (err) {
                                              console.error('Failed to update required status', err)
                                            }
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {field.selected_value ? (
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Chip label={field.selected_value} size="small" color="primary" />
                                            {field.valid_values?.length > 0 && (
                                              <Typography variant="body2" color="text.secondary">
                                                ({field.valid_values.length})
                                              </Typography>
                                            )}
                                          </Box>
                                        ) : field.custom_value ? (
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Chip
                                              label={field.custom_value.length > 30 ? field.custom_value.substring(0, 30) + '...' : field.custom_value}
                                              size="small"
                                              color="success"
                                              title={field.custom_value}
                                            />
                                            {field.valid_values?.length > 0 && (
                                              <Typography variant="body2" color="text.secondary">
                                                ({field.valid_values.length})
                                              </Typography>
                                            )}
                                          </Box>
                                        ) : field.valid_values?.length > 0 ? (
                                          <Typography variant="body2" color="text.secondary">
                                            {field.valid_values.length} values
                                          </Typography>
                                        ) : (
                                          <Typography variant="body2" color="text.secondary">Any</Typography>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </AccordionDetails>
                          </Accordion>
                        )
                      })
                    })()}
                  </Box>
                </>
              ) : (
                // CUSTOMIZATION DETAILS
                <Box>
                  <Typography variant="h6">Customization Template Details</Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography><strong>Filename:</strong> {(selectedTemplate as AmazonCustomizationTemplate).original_filename}</Typography>
                    <Typography><strong>Upload Date:</strong> {new Date((selectedTemplate as AmazonCustomizationTemplate).upload_date).toLocaleString()}</Typography>
                    <Typography><strong>Size:</strong> {(selectedTemplate as AmazonCustomizationTemplate).file_size} bytes</Typography>
                    <Typography sx={{ mt: 2, fontStyle: 'italic', color: 'text.secondary' }}>
                      This is a raw Excel template used for generating customization files. No field mapping is required.
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>
          )}
        </Grid>
      </Grid>

      {showPreview && selectedTemplate && templateType === 'product' && (
        <TemplatePreview template={selectedTemplate as AmazonProductType} onClose={() => setShowPreview(false)} />
      )}

      {selectedField && selectedTemplate && templateType === 'product' && (
        <FieldDetailsDialog
          field={selectedField}
          onClose={() => setSelectedField(null)}
          onUpdate={(updatedField) => {
            // Update local state for immediate feedback
            // (Abbreviated update logic for brevity - in real app full update is safer, but here relying on reloadData or basic immutability)
            const pt = selectedTemplate as AmazonProductType
            const newFields = pt.fields.map(f => f.id === updatedField.id ? updatedField : f)
            const newPt = { ...pt, fields: newFields }
            setSelectedTemplate(newPt)
            setProductTypeTemplates(prev => prev.map(p => p.id === newPt.id ? newPt : p))
            setSelectedField(updatedField)
          }}
        />
      )}

      {/* Customization Template Preview Modal */}
      <CustomizationTemplateFilePreview
        open={isCustPreviewOpen}
        onClose={() => setIsCustPreviewOpen(false)}
        loading={custPreviewLoading}
        error={custPreviewError}
        data={custPreviewData}
      />
    </Box>
  )
}
