import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, TextField, Grid, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Alert, CircularProgress, FormControl, InputLabel, Select, MenuItem, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningIcon from '@mui/icons-material/Warning'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LinkIcon from '@mui/icons-material/Link'
import AddIcon from '@mui/icons-material/Add'
import { templatesApi, equipmentTypesApi, type EquipmentTypeProductTypeLink } from '../services/api'
import type { AmazonProductType, EquipmentType } from '../types'

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
  const [templates, setTemplates] = useState<AmazonProductType[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<AmazonProductType | null>(null)
  const [productCode, setProductCode] = useState('')
  const [selectedExistingCode, setSelectedExistingCode] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null)
  
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [equipmentTypeLinks, setEquipmentTypeLinks] = useState<EquipmentTypeProductTypeLink[]>([])
  const [selectedEquipmentTypeId, setSelectedEquipmentTypeId] = useState<number | ''>('')
  const [selectedProductTypeId, setSelectedProductTypeId] = useState<number | ''>('')

  const loadTemplates = async () => {
    const data = await templatesApi.list()
    setTemplates(data)
  }
  
  const loadEquipmentTypes = async () => {
    const data = await equipmentTypesApi.list()
    setEquipmentTypes(data)
  }
  
  const loadLinks = async () => {
    const data = await templatesApi.listEquipmentTypeLinks()
    setEquipmentTypeLinks(data)
  }

  useEffect(() => {
    loadTemplates()
    loadEquipmentTypes()
    loadLinks()
  }, [])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>, isUpdate: boolean) => {
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

  const handleConfirmUpload = async () => {
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
      loadTemplates()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to import template')
    } finally {
      setUploading(false)
      if (fileInputRef) {
        fileInputRef.value = ''
      }
    }
  }

  const handleCancelUpload = () => {
    setPendingUpload(null)
    if (fileInputRef) {
      fileInputRef.value = ''
    }
  }

  const handleDelete = async (code: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      await templatesApi.delete(code)
      loadTemplates()
      if (selectedTemplate?.code === code) {
        setSelectedTemplate(null)
      }
    }
  }

  const viewTemplate = async (code: string) => {
    const template = await templatesApi.get(code)
    setSelectedTemplate(template)
  }
  
  const handleCreateLink = async () => {
    if (selectedEquipmentTypeId === '' || selectedProductTypeId === '') {
      setError('Please select both an Equipment Type and a Product Type')
      return
    }
    
    try {
      await templatesApi.createEquipmentTypeLink(selectedEquipmentTypeId, selectedProductTypeId)
      setSuccess('Equipment Type linked to Product Type successfully')
      setSelectedEquipmentTypeId('')
      setSelectedProductTypeId('')
      loadLinks()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to create link')
    }
  }
  
  const handleDeleteLink = async (linkId: number) => {
    try {
      await templatesApi.deleteEquipmentTypeLink(linkId)
      loadLinks()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } }
      setError(err.response?.data?.detail || 'Failed to delete link')
    }
  }
  
  const getEquipmentTypeName = (id: number) => {
    const et = equipmentTypes.find(e => e.id === id)
    return et?.name || `ID: ${id}`
  }
  
  const getProductTypeName = (id: number) => {
    const pt = templates.find(t => t.id === id)
    return pt?.code || `ID: ${id}`
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Amazon Templates</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Import New Product Type</Typography>
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
              Upload New Template
              <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleFileSelect(e, false)} />
            </Button>
          </Grid>
        </Grid>
        
        {templates.length > 0 && (
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
                    {templates.map((t) => (
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
                  <input type="file" hidden accept=".xlsx,.xls" onChange={(e) => handleFileSelect(e, true)} />
                </Button>
              </Grid>
            </Grid>
          </>
        )}
        
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
      </Paper>

      {templates.length > 0 && equipmentTypes.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinkIcon /> Link Equipment Types to Product Types
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Associate your equipment types with Amazon Product Type templates. This determines which template fields are used when creating listings for each equipment type.
          </Typography>
          
          <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Equipment Type</InputLabel>
                <Select
                  value={selectedEquipmentTypeId}
                  label="Equipment Type"
                  onChange={(e) => setSelectedEquipmentTypeId(e.target.value as number)}
                >
                  {equipmentTypes.map((et) => (
                    <MenuItem key={et.id} value={et.id}>{et.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Product Type Template</InputLabel>
                <Select
                  value={selectedProductTypeId}
                  label="Product Type Template"
                  onChange={(e) => setSelectedProductTypeId(e.target.value as number)}
                >
                  {templates.map((t) => (
                    <MenuItem key={t.id} value={t.id}>{t.code}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleCreateLink}
                disabled={selectedEquipmentTypeId === '' || selectedProductTypeId === ''}
              >
                Create Link
              </Button>
            </Grid>
          </Grid>
          
          {equipmentTypeLinks.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Equipment Type</TableCell>
                    <TableCell>Product Type Template</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {equipmentTypeLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell>{getEquipmentTypeName(link.equipment_type_id)}</TableCell>
                      <TableCell>{getProductTypeName(link.product_type_id)}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleDeleteLink(link.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      <Dialog open={pendingUpload !== null} onClose={handleCancelUpload}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {pendingUpload?.matchStatus === 'match' ? (
            <CheckCircleIcon color="success" />
          ) : (
            <WarningIcon color="warning" />
          )}
          {pendingUpload?.matchStatus === 'match' ? 'Confirm Upload' : 'File Mismatch Warning'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingUpload?.matchStatus === 'match' ? (
              <>
                The file <strong>{pendingUpload?.file.name}</strong> appears to match 
                the Product Type <strong>{pendingUpload?.productCode}</strong>.
                <br /><br />
                Do you want to proceed with the {pendingUpload?.isUpdate ? 'update' : 'import'}?
              </>
            ) : (
              <>
                The file <strong>{pendingUpload?.file.name}</strong> does not appear to match 
                the Product Type <strong>{pendingUpload?.productCode}</strong>.
                <br /><br />
                Are you sure you want to use this file to {pendingUpload?.isUpdate ? 'update' : 'import'} this Product Type?
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelUpload}>Cancel</Button>
          <Button 
            onClick={handleConfirmUpload} 
            variant="contained"
            color={pendingUpload?.matchStatus === 'match' ? 'primary' : 'warning'}
          >
            {pendingUpload?.matchStatus === 'match' ? 'Proceed' : 'Yes, Use This File'}
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Imported Templates</Typography>
            {templates.length === 0 ? (
              <Typography color="text.secondary">
                No templates imported yet. Upload an Amazon template file to get started.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Code</TableCell>
                      <TableCell>Fields</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {templates.map((template) => (
                      <TableRow 
                        key={template.id}
                        hover
                        selected={selectedTemplate?.id === template.id}
                        onClick={() => viewTemplate(template.code)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{template.code}</TableCell>
                        <TableCell>{template.fields?.length || 0}</TableCell>
                        <TableCell>
                          <IconButton 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(template.code)
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Template Fields
              {selectedTemplate && ` - ${selectedTemplate.code}`}
            </Typography>
            
            {selectedTemplate ? (
              <Box>
                {selectedTemplate.keywords && selectedTemplate.keywords.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>Keywords:</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {selectedTemplate.keywords.map((kw) => (
                        <Chip key={kw.id} label={kw.keyword} size="small" />
                      ))}
                    </Box>
                  </Box>
                )}
                
                <TableContainer sx={{ maxHeight: 400 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Field Name</TableCell>
                        <TableCell>Group</TableCell>
                        <TableCell>Required</TableCell>
                        <TableCell>Valid Values</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedTemplate.fields?.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell>{field.field_name}</TableCell>
                          <TableCell>{field.attribute_group || '-'}</TableCell>
                          <TableCell>
                            {field.required ? (
                              <Chip label="Required" size="small" color="error" />
                            ) : (
                              <Chip label="Optional" size="small" />
                            )}
                          </TableCell>
                          <TableCell>
                            {field.valid_values?.length > 0 
                              ? `${field.valid_values.length} values`
                              : 'Any'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ) : (
              <Typography color="text.secondary">
                Select a template to view its fields
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}
