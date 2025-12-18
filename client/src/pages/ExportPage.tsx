import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, Grid, Checkbox,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, CircularProgress, FormControl, InputLabel, Select, MenuItem,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButton, ToggleButtonGroup, Tooltip
} from '@mui/material'
import PreviewIcon from '@mui/icons-material/Preview'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import { manufacturersApi, seriesApi, modelsApi, templatesApi, exportApi } from '../services/api'
import type { Manufacturer, Series, Model, AmazonProductType } from '../types'

interface ModelWithTemplate extends Model {
  manufacturer_name: string
  series_name: string
  equipment_type_name: string
  template_code?: string
}

interface ExportPreviewData {
  headers: string[][]
  rows: { model_id: number; model_name: string; data: (string | null)[] }[]
  template_code: string
}

const rowStyles: Record<number, React.CSSProperties> = {
  0: { backgroundColor: '#1976d2', color: 'white', fontWeight: 'bold', fontSize: '11px' },
  1: { backgroundColor: '#2196f3', color: 'white', fontSize: '11px' },
  2: { backgroundColor: '#4caf50', color: 'white', fontWeight: 'bold', fontSize: '11px' },
  3: { backgroundColor: '#8bc34a', color: 'black', fontWeight: 'bold', fontSize: '11px' },
  4: { backgroundColor: '#c8e6c9', color: 'black', fontSize: '10px' },
  5: { backgroundColor: '#fff9c4', color: 'black', fontStyle: 'italic', fontSize: '10px' },
}

export default function ExportPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [allModels, setAllModels] = useState<Model[]>([])
  const [templates, setTemplates] = useState<AmazonProductType[]>([])
  const [equipmentTypeLinks, setEquipmentTypeLinks] = useState<{equipment_type_id: number, product_type_id: number}[]>([])
  
  const [selectedManufacturer, setSelectedManufacturer] = useState<number | ''>('')
  const [selectedSeries, setSelectedSeries] = useState<number | ''>('')
  const [selectedModels, setSelectedModels] = useState<Set<number>>(new Set())
  
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null)
  const [listingType, setListingType] = useState<'individual' | 'parent_child'>('individual')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [mfrs, series, models, tmpls, links] = await Promise.all([
        manufacturersApi.list(),
        seriesApi.list(),
        modelsApi.list(),
        templatesApi.list(),
        templatesApi.listEquipmentTypeLinks()
      ])
      setManufacturers(mfrs)
      setAllSeries(series)
      setAllModels(models)
      setTemplates(tmpls)
      setEquipmentTypeLinks(links)
    } catch (err) {
      setError('Failed to load data')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const filteredSeries = selectedManufacturer 
    ? allSeries.filter(s => s.manufacturer_id === selectedManufacturer)
    : allSeries

  const filteredModels = selectedSeries
    ? allModels.filter(m => m.series_id === selectedSeries)
    : selectedManufacturer
      ? allModels.filter(m => filteredSeries.some(s => s.id === m.series_id))
      : allModels

  const getTemplateForEquipmentType = (equipmentTypeId: number): string | undefined => {
    const link = equipmentTypeLinks.find(l => l.equipment_type_id === equipmentTypeId)
    if (!link) return undefined
    const template = templates.find(t => t.id === link.product_type_id)
    return template?.code
  }

  const getSeriesName = (seriesId: number): string => {
    const series = allSeries.find(s => s.id === seriesId)
    return series?.name || 'Unknown'
  }

  const getManufacturerName = (seriesId: number): string => {
    const series = allSeries.find(s => s.id === seriesId)
    if (!series) return 'Unknown'
    const mfr = manufacturers.find(m => m.id === series.manufacturer_id)
    return mfr?.name || 'Unknown'
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedModels(new Set(filteredModels.map(m => m.id)))
    } else {
      setSelectedModels(new Set())
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

  const handleGeneratePreview = async () => {
    if (selectedModels.size === 0) {
      setError('Please select at least one model')
      return
    }

    try {
      setGenerating(true)
      setError(null)
      const modelIds = Array.from(selectedModels)
      const preview = await exportApi.generatePreview(modelIds, listingType)
      setPreviewData(preview)
      setPreviewOpen(true)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to generate preview')
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const allSelected = filteredModels.length > 0 && filteredModels.every(m => selectedModels.has(m.id))
  const someSelected = filteredModels.some(m => selectedModels.has(m.id))

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Amazon Export
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Select models to generate an Amazon export worksheet. Models are automatically matched with templates based on their equipment type.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filter Models
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Manufacturer</InputLabel>
              <Select
                value={selectedManufacturer}
                label="Manufacturer"
                onChange={(e) => {
                  setSelectedManufacturer(e.target.value as number | '')
                  setSelectedSeries('')
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
                value={selectedSeries}
                label="Series"
                onChange={(e) => {
                  setSelectedSeries(e.target.value as number | '')
                  setSelectedModels(new Set())
                }}
                disabled={!selectedManufacturer}
              >
                <MenuItem value="">All Series</MenuItem>
                {filteredSeries.map(s => (
                  <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', height: '100%' }}>
              <Typography variant="body2" color="text.secondary">
                {selectedModels.size} model{selectedModels.size !== 1 ? 's' : ''} selected
              </Typography>
              <Button
                variant="contained"
                startIcon={<PreviewIcon />}
                onClick={handleGeneratePreview}
                disabled={selectedModels.size === 0 || generating}
              >
                {generating ? 'Generating...' : 'Generate Preview'}
              </Button>
            </Box>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #eee' }}>
          <Typography variant="subtitle2" gutterBottom>
            Listing Type
          </Typography>
          <ToggleButtonGroup
            value={listingType}
            exclusive
            onChange={(_, value) => value && setListingType(value)}
            size="small"
          >
            <ToggleButton value="individual">
              <Tooltip title="Each model gets its own unique SKU in contribution_sku">
                <span>Individual / Standard</span>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="parent_child" disabled>
              <Tooltip title="Parent/Child listing (Coming Soon)">
                <span>Parent / Child</span>
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
            {listingType === 'individual' 
              ? 'Each model will use its Parent SKU as the contribution_sku value'
              : 'Parent/Child listing support coming soon'}
          </Typography>
        </Box>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <TableContainer sx={{ maxHeight: 500 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>Model</TableCell>
                <TableCell>Series</TableCell>
                <TableCell>Manufacturer</TableCell>
                <TableCell>Dimensions (W×D×H)</TableCell>
                <TableCell>Template</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">No models found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredModels.map(model => {
                  const templateCode = getTemplateForEquipmentType(model.equipment_type_id)
                  return (
                    <TableRow 
                      key={model.id}
                      hover
                      selected={selectedModels.has(model.id)}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedModels.has(model.id)}
                          onChange={(e) => handleSelectModel(model.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>{model.name}</TableCell>
                      <TableCell>{getSeriesName(model.series_id)}</TableCell>
                      <TableCell>{getManufacturerName(model.series_id)}</TableCell>
                      <TableCell>{model.width}" × {model.depth}" × {model.height}"</TableCell>
                      <TableCell>
                        {templateCode ? (
                          <Chip label={templateCode} size="small" color="primary" variant="outlined" />
                        ) : (
                          <Chip label="No template" size="small" color="warning" variant="outlined" />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {previewOpen && previewData && (
        <Dialog 
          open={previewOpen} 
          onClose={() => setPreviewOpen(false)} 
          maxWidth={false} 
          fullWidth 
          PaperProps={{ 
            sx: { 
              maxWidth: '95vw', 
              height: '85vh',
              resize: 'both',
              overflow: 'auto',
              minWidth: 600,
              minHeight: 400
            } 
          }}
        >
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h6">
                Export Preview - {previewData.template_code}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {previewData.rows.length} model{previewData.rows.length !== 1 ? 's' : ''} ready for export
              </Typography>
            </Box>
            <IconButton onClick={() => setPreviewOpen(false)}><CloseIcon /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 0 }}>
            <Box sx={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(85vh - 150px)' }}>
              <Table size="small" sx={{ minWidth: previewData.headers[0]?.length * 140 || 1000, tableLayout: 'fixed' }}>
                <TableBody>
                  {previewData.headers.map((row, rowIdx) => (
                    <TableRow key={`header-${rowIdx}`}>
                      {row.map((cell, colIdx) => (
                        <TableCell
                          key={colIdx}
                          sx={{
                            ...rowStyles[rowIdx] || {},
                            border: '1px solid #ccc',
                            padding: '4px 8px',
                            width: 140,
                            minWidth: 140,
                            maxWidth: 140,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={cell || ''}
                        >
                          {cell || ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {previewData.rows.map((row, rowIdx) => (
                    <TableRow key={`data-${row.model_id}`} sx={{ '&:nth-of-type(odd)': { backgroundColor: '#fafafa' } }}>
                      {row.data.map((cell, colIdx) => (
                        <TableCell
                          key={colIdx}
                          sx={{
                            border: '1px solid #ccc',
                            padding: '4px 8px',
                            width: 140,
                            minWidth: 140,
                            maxWidth: 140,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '11px',
                          }}
                          title={cell || ''}
                        >
                          {cell || ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button variant="contained" startIcon={<DownloadIcon />} disabled>
              Download Excel (Coming Soon)
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}
