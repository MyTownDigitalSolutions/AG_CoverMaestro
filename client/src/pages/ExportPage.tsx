import { useEffect, useState, useMemo } from 'react'
import {
  Box, Typography, Paper, Button, Grid, Checkbox, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, CircularProgress, FormControl, InputLabel, Select, MenuItem,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  ToggleButton, ToggleButtonGroup, Tooltip,
  Accordion, AccordionSummary, AccordionDetails, Switch, FormControlLabel, Radio, RadioGroup, FormLabel, Stack
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import PreviewIcon from '@mui/icons-material/Preview'
import CloseIcon from '@mui/icons-material/Close'
import DownloadIcon from '@mui/icons-material/Download'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import GppBadIcon from '@mui/icons-material/GppBad'
import RefreshIcon from '@mui/icons-material/Refresh'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import WarningIcon from '@mui/icons-material/Warning'
import ErrorIcon from '@mui/icons-material/Error'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { manufacturersApi, seriesApi, modelsApi, templatesApi, exportApi, pricingApi, settingsApi, equipmentTypesApi, type ExportValidationResponse, type ExportValidationIssue } from '../services/api'
import { pickBaseDirectory, ensureSubdirectory, writeFileAtomic, loadHandle, clearPersistedHandle, getOrPickWritableBaseDirectory } from '../services/fileSystem'
import type { Manufacturer, Series, Model, AmazonProductType, EquipmentType } from '../types'

interface AuditFieldAction {
  field_name: string
  column_index: number
  rule_explanation: string
  source?: {
    marketplace: string
    variant_key: string
    entity: string
    field: string
  }
}

interface AuditData {
  row_mode: string
  pricing: { matched_price_fields: AuditFieldAction[] }
  sku: { matched_sku_fields: AuditFieldAction[] }
  row_samples: { model_id: number; model_name: string; key_values: Record<string, string | null> }[]
}

interface ExportPreviewData {
  headers: (string | null)[][]
  rows: { model_id: number; model_name: string; data: (string | null)[] }[]
  template_code: string
  export_signature?: string
  field_map?: Record<string, number>
  audit?: AuditData
}

interface WriteResult {
  key: string // unique ID for retry targeting (e.g. "master", "series-123")
  filename: string
  status: 'success' | 'failed' | 'pending'
  errorMessage?: string
  warning?: string
  verified?: boolean
  verificationReason?: string
}

const rowStyles: Record<number, React.CSSProperties> = {
  0: { backgroundColor: '#1976d2', color: 'white', fontWeight: 'bold', fontSize: '11px' },
  1: { backgroundColor: '#2196f3', color: 'white', fontSize: '11px' },
  2: { backgroundColor: '#4caf50', color: 'white', fontWeight: 'bold', fontSize: '11px' },
  3: { backgroundColor: '#8bc34a', color: 'black', fontWeight: 'bold', fontSize: '11px' },
  4: { backgroundColor: '#c8e6c9', color: 'black', fontSize: '10px' },
  5: { backgroundColor: '#fff9c4', color: 'black', fontStyle: 'italic', fontSize: '10px' },
}



const normalizeName = (s?: string | null) => (s ?? '').trim().toLowerCase()

const compareByNameThenId = (a: { name?: string | null, id: number }, b: { name?: string | null, id: number }) => {
  const nameA = normalizeName(a.name)
  const nameB = normalizeName(b.name)
  if (nameA < nameB) return -1
  if (nameA > nameB) return 1
  return a.id - b.id
}

export default function ExportPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [allModels, setAllModels] = useState<Model[]>([])
  const [allEquipmentTypes, setAllEquipmentTypes] = useState<EquipmentType[]>([])
  const [templates, setTemplates] = useState<AmazonProductType[]>([])
  const [equipmentTypeLinks, setEquipmentTypeLinks] = useState<{ equipment_type_id: number, product_type_id: number }[]>([])
  // Phase 7: Export Settings
  const [exportSettings, setExportSettings] = useState<{ id: number; default_save_path_template?: string; amazon_customization_export_format?: string } | null>(null)
  const [localSavePathTemplate, setLocalSavePathTemplate] = useState('')

  const [selectedManufacturer, setSelectedManufacturer] = useState<number | ''>('')
  const [selectedSeries, setSelectedSeries] = useState<number | ''>('')
  const [selectedModels, setSelectedModels] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missingSnapshots, setMissingSnapshots] = useState<Record<number, string[]> | null>(null)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null)
  const [listingType, setListingType] = useState<'individual' | 'parent_child'>('individual')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [includeCustomization, setIncludeCustomization] = useState(true)

  // Phase 9: File System Access
  const [baseDir, setBaseDir] = useState<any | null>(null) // Using any to avoid strict type ref issues if libs mismatch, though typed in service
  const [fsStatus, setFsStatus] = useState<string | null>(null)
  const [writeResults, setWriteResults] = useState<WriteResult[]>([])
  const [lastSavePlanSnapshot, setLastSavePlanSnapshot] = useState<any | null>(null) // Store plan for retry reliability



  // Phase 12: Export Confidence Verification
  const [lastDownloadSignature, setLastDownloadSignature] = useState<string | null>(null)
  const [lastDownloadTemplateCode, setLastDownloadTemplateCode] = useState<string | null>(null)

  // Phase 13A: Validation
  const [validating, setValidating] = useState(false)
  const [validationReport, setValidationReport] = useState<ExportValidationResponse | null>(null)
  const [postExportImageWarnings, setPostExportImageWarnings] = useState<ExportValidationIssue[]>([])

  // Phase 14A: Validation Caching
  const [lastValidationKey, setLastValidationKey] = useState<string | null>(null)
  const [lastValidationAtMs, setLastValidationAtMs] = useState<number | null>(null)
  const VALIDATION_TTL_MS = 60000

  // Phase 14A: Load Instumentation
  const [loadStep, setLoadStep] = useState<string>('Starting')
  const [loadError, setLoadError] = useState<string | null>(null)

  // Customization Format State
  const [localCustomizationFormat, setLocalCustomizationFormat] = useState<string>('xlsx')
  const [custCopyCopied, setCustCopyCopied] = useState(false)

  // Computed Status Logic (Phase 4 - Chunk 3)
  const missingTemplateNames = useMemo(() => {
    if (!includeCustomization) return []
    const missingSet = new Set<string>()
    selectedModels.forEach(modelId => {
      const model = allModels.find(m => m.id === modelId)
      if (model) {
        const et = allEquipmentTypes.find(e => e.id === model.equipment_type_id)
        // If ET missing OR template assignment missing, it's a "missing" case
        if (!et || !et.amazon_customization_template_id) {
          missingSet.add(et ? et.name : `Unknown Equipment Type (ID: ${model.equipment_type_id})`)
        }
      }
    })
    return Array.from(missingSet)
  }, [includeCustomization, selectedModels, allModels, allEquipmentTypes])

  useEffect(() => {
    loadData()
    loadHandle().then(h => { if (h) setBaseDir(h) })
  }, [])

  const loadData = async () => {
    // Watchdog
    const watchdog = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.error('[EXPORT] Initialization Timeout (15s)')
          setLoadError('Initialization timed out (15s). Please check your connection.')
          return false
        }
        return prev
      })
    }, 15000)

    try {
      setLoading(true)
      setLoadError(null)

      console.log('[EXPORT] Starting Data Load')
      setLoadStep('Fetching API Data...')

      const [mfrs, series, models, eqTypes, tmpls, links, expSettings] = await Promise.all([
        manufacturersApi.list().catch((e: any) => { throw new Error(`Manufacturers: ${e.message}`) }),
        seriesApi.list().catch((e: any) => { throw new Error(`Series: ${e.message}`) }),
        modelsApi.list().catch((e: any) => { throw new Error(`Models: ${e.message}`) }),
        equipmentTypesApi.list().catch((e: any) => { throw new Error(`Equipment Types: ${e.message}`) }),
        templatesApi.list().catch((e: any) => { throw new Error(`Templates: ${e.message}`) }),
        templatesApi.listEquipmentTypeLinks().catch((e: any) => { throw new Error(`Links: ${e.message}`) }),
        settingsApi.getExport().catch((e: any) => { throw new Error(`Settings: ${e.message}`) })
      ])

      console.log('[EXPORT] Data Load Complete')
      setLoadStep('Processing Data...')

      setManufacturers(mfrs)
      setAllSeries(series)
      setAllModels(models)
      setAllEquipmentTypes(eqTypes)
      setTemplates(tmpls)
      setEquipmentTypeLinks(links)
      setExportSettings(expSettings)
      setLocalSavePathTemplate(expSettings.default_save_path_template || '')
      setLocalCustomizationFormat(expSettings.amazon_customization_export_format || 'xlsx')

    } catch (err: any) {
      console.error('[EXPORT] Data Load Failed', err)
      setLoadError(err.message || 'Failed to initialize export data')
      setError('Failed to load data')
    } finally {
      clearTimeout(watchdog)
      setLoading(false)
    }
  }

  const handleSaveExportSettings = async () => {
    try {
      const updated = await settingsApi.updateExport({
        default_save_path_template: localSavePathTemplate,
        amazon_customization_export_format: localCustomizationFormat
      })
      setExportSettings(updated)
      alert('Export configuration saved.')
    } catch (err) {
      console.error(err)
      alert('Failed to save export configuration')
    }
  }

  // ... (previous filter logic)

  // Compute Save Plan
  const savePlan = useMemo(() => {
    if (!selectedManufacturer || selectedModels.size === 0 || !exportSettings?.default_save_path_template) {
      return null
    }

    const mfrName = manufacturers.find(m => m.id === selectedManufacturer)?.name || 'Unknown'
    const marketplace = 'Amazon' // Static for now

    // Determine involved series
    const involvedSeriesIds = new Set<number>()
    selectedModels.forEach(mid => {
      const model = allModels.find(m => m.id === mid)
      if (model) involvedSeriesIds.add(model.series_id)
    })

    const involvedSeries = allSeries.filter(s => involvedSeriesIds.has(s.id))
    const isMultiSeries = involvedSeries.length > 1

    const replacePlaceholders = (template: string, seriesName: string) => {
      return template
        .replace(/\[Manufacturer_Name\]/g, mfrName)
        .replace(/\[Series_Name\]/g, seriesName)
        .replace(/\[Marketplace\]/g, marketplace)
        // Basic sanitization
        .replace(/[<>"|?*]/g, '') // Kept : and / for path separation
    }

    const basePath = exportSettings.default_save_path_template

    if (isMultiSeries) {
      // Master Plan
      // Note: We might not have a specific Series Name for the master file path if the template uses [Series_Name]
      // The prompt says: master folder: Base\[Manufacturer]\[Marketplace]-[Manufacturer]-Multi-Series.xlsx
      // But the path comes from the template. 
      // If template is "C:\Exports\[Manufacturer]\[Series]", then master path is ambiguous.
      // We will assume the User's template path ends in a folder structure, and we append filenames.

      // Prompt Rule: 
      // Master: Base\[Manufacturer]\[Marketplace]-[Manufacturer]-Multi-Series.xlsx
      // We'll try to deduce "Base" from the template. 
      // Actually the Template IS the path. 
      // "Example value: ...\Listings\[Manufacturer_Name]\[Series_Name]"

      // So for Single Series: Path = Template. File = [Marketplace]-[Manufacturer]-[Series].xlsx
      // For Multi Series: 
      //   Master Path = Template (but what is Series_Name?). 
      //   Prompt says: "folder: Base\[Manufacturer]\[Series]"

      // Let's interpret the template as the folder path.
      // If template has [Series_Name], we can't resolve it for a multi-series master file easily unless we say "Multi-Series" is the series name.

      const masterSeriesName = "Multi-Series"
      const masterFolder = replacePlaceholders(basePath, masterSeriesName)
      const masterFile = `${marketplace}-${mfrName.replace(/\s+/g, '_')}-Multi_Series.xlsx`

      const perSeriesPlans = involvedSeries.map(s => {
        const folder = replacePlaceholders(basePath, s.name)
        const filename = `${marketplace}-${mfrName.replace(/\s+/g, '_')}-${s.name.replace(/\s+/g, '_')}.xlsx`
        return { folder, filename, seriesId: s.id }
      })

      return {
        type: 'multi',
        master: { folder: masterFolder, filename: masterFile },
        children: perSeriesPlans
      }
    } else {
      // Single Series
      const series = involvedSeries[0]
      if (!series) return null

      const folder = replacePlaceholders(basePath, series.name)
      const filename = `${marketplace}-${mfrName.replace(/\s+/g, '_')}-${series.name.replace(/\s+/g, '_')}.xlsx`

      return {
        type: 'single',
        plan: { folder, filename }
      }
    }
  }, [selectedManufacturer, selectedModels, exportSettings, manufacturers, allSeries, allModels])

  // ... (previous render logic)



  const filteredSeries = selectedManufacturer
    ? allSeries.filter(s => s.manufacturer_id === selectedManufacturer)
    : allSeries

  // Deterministic Sort for Display: Name A-Z
  const sortedSeries = useMemo(() => {
    return [...filteredSeries].sort(compareByNameThenId);
  }, [filteredSeries]);

  const filteredModels = useMemo(() => {
    if (!selectedManufacturer) return []

    let models = allModels.filter(m => {
      const series = allSeries.find(s => s.id === m.series_id)
      return series?.manufacturer_id === selectedManufacturer
    })

    if (selectedSeries) {
      models = models.filter(m => m.series_id === selectedSeries)
    }

    // Deterministic Sort for Display: Name A-Z (case-insensitive), then ID
    return [...models].sort(compareByNameThenId)
  }, [selectedManufacturer, selectedSeries, allModels, allSeries])

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

  const handleRecalculateSelected = async () => {
    if (selectedModels.size === 0) return
    try {
      setRecalculating(true)
      setError(null)
      const modelIds = Array.from(selectedModels)
      await pricingApi.recalculateBaselines({
        model_ids: modelIds,
        only_if_stale: false
      })
      alert('Recalculation complete for selected models.')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to recalculate')
      console.error(err)
    } finally {
      setRecalculating(false)
    }
  }

  const handleRecalcAndPreview = async () => {
    if (selectedModels.size === 0) return

    try {
      setRecalculating(true)
      setError(null)
      const modelIds = Array.from(selectedModels)
      await pricingApi.recalculateBaselines({
        model_ids: modelIds,
        only_if_stale: false
      })

      setRecalculating(false)
      await handleGeneratePreview()

    } catch (err: any) {
      setRecalculating(false)
      setError(err.response?.data?.detail || 'Recalculation failed')
      console.error(err)
    }
  }

  const handleGeneratePreview = async () => {
    if (selectedModels.size === 0) {
      setError('Please select at least one model')
      return
    }

    try {
      setGenerating(true)
      setError(null)
      setMissingSnapshots(null)

      const modelIds = Array.from(selectedModels)

      // Preflight Check
      const status = await pricingApi.verifySnapshotStatus(modelIds)
      if (!status.complete) {
        setMissingSnapshots(status.missing_snapshots)
        return
      }

      // Clear previous download verification state
      setLastDownloadSignature(null)
      setLastDownloadTemplateCode(null)

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

  const getFreshValidationReport = async (): Promise<ExportValidationResponse> => {
    // Construct deterministc key for current scope
    const ids = Array.from(selectedModels).sort((a, b) => a - b).join(',')
    const currentKey = `${selectedManufacturer}-${selectedSeries}-${listingType}-${ids}`
    const now = Date.now()

    // Check Cache
    if (validationReport && lastValidationKey === currentKey && lastValidationAtMs && (now - lastValidationAtMs < VALIDATION_TTL_MS)) {
      return validationReport
    }

    // Cache Miss - Fetch Fresh
    const report = await exportApi.validateExport(Array.from(selectedModels), listingType)
    setValidationReport(report)
    setLastValidationKey(currentKey)
    setLastValidationAtMs(now)
    return report
  }

  const handleValidateExport = async () => {
    try {
      setValidating(true)
      // Do not clear validationReport immediately to avoid flicker if cached
      await getFreshValidationReport()
    } catch (err) {
      console.error(err)
      setError("Failed to run validation check")
      setValidationReport(null) // Clear if failed
    } finally {
      setValidating(false)
    }
  }

  const handleZipDownload = async () => {
    try {
      setDownloading('zip')
      const modelIds = Array.from(selectedModels)

      // Compute Tokens
      const marketplaceToken = "Amazon" // Hardcoded for now

      const mfr = manufacturers.find(m => m.id === selectedManufacturer)
      const manufacturerToken = mfr ? normalizeName(mfr.name) : "UnknownManufacturer"

      let seriesToken = "UnknownSeries"
      if (selectedSeries !== '') {
        const s = allSeries.find(s => s.id === selectedSeries)
        seriesToken = s ? normalizeName(s.name) : "UnknownSeries"
      } else {
        // If no specific series selected, but we have models, it implies Multiple Series (or All)
        seriesToken = "Multiple_Series"
      }

      const dateToken = new Date().toISOString().split('T')[0] // YYYY-MM-DD

      const tokens = {
        marketplace: marketplaceToken,
        manufacturer: manufacturerToken,
        series: seriesToken,
        date: dateToken
      }

      console.log("[EXPORT][ZIP] Starting download", tokens)

      const response = await exportApi.downloadZip(modelIds, listingType, includeCustomization, tokens, localCustomizationFormat)

      // Filename from header
      let filename = `${tokens.marketplace}-${tokens.manufacturer}-${tokens.series}-Product_Upload-${tokens.date}.zip`
      const disposition = response.headers['content-disposition']
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        const matches = filenameRegex.exec(disposition)
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '')
        }
      }

      const blob = new Blob([response.data], { type: 'application/zip' })
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

      setFsStatus("ZIP Download started.")
      setTimeout(() => setFsStatus(null), 3000)

    } catch (e: any) {
      console.error("[EXPORT][ZIP] download failed", e)
      setError("ZIP Download failed: " + (e.message || "Unknown error"))
    } finally {
      setDownloading(null)
    }
  }

  const handleFileSystemDownload = async (format: 'xlsx' | 'xlsm' | 'csv', retryMode = false) => {
    console.log(`[EXPORT][${format.toUpperCase()}] click: start`);
    console.trace(`[EXPORT][${format.toUpperCase()}] click stack`);
    try {
      setDownloading(format)

      // Explicit XLSM Branch: Bypass File System API (Fix for Windows Env)
      if (format === 'xlsm') {
        console.log("[EXPORT][XLSM] bypassing file system picker");
        setError(null);
        setFsStatus("Generating XLSM...");
        const modelIds = Array.from(selectedModels);

        try {
          // Direct Browser Download
          const response = await exportApi.downloadXlsm(modelIds, listingType);

          // Extract filename from headers or default
          let filename = "Amazon_Export.xlsm";
          const disposition = response.headers['content-disposition'];
          if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          } else {
            // Fallback naming
            const mfrName = manufacturers.find(m => m.id === selectedManufacturer)?.name || 'Export';
            filename = `Amazon-${mfrName.replace(/\s+/g, '_')}.xlsm`;
          }

          // Updates for verification stats
          const sig = response.headers['x-export-signature'];
          const tCode = response.headers['x-export-template-code'];
          if (sig) setLastDownloadSignature(sig);
          if (tCode) setLastDownloadTemplateCode(tCode);

          // Trigger Download
          const contentType = response.headers['content-type'] || 'application/vnd.ms-excel.sheet.macroEnabled.12';
          const blob = new Blob([response.data], { type: contentType });

          // Safety: If blob is JSON, it means backend errored despite 200 (or axios logic mishandled)
          if (contentType.includes('application/json')) {
            const text = await response.data.text();
            throw new Error(`Server returned JSON instead of file: ${text.substring(0, 100)}`);
          }

          // Fix extension based on content type (Backend may return XLSX now)
          const isXlsx = contentType.includes('spreadsheetml.sheet');
          const targetExt = isXlsx ? '.xlsx' : '.xlsm';

          // Remove potential existing extension to avoid duplication (e.g. .xlsx.xlsm)
          filename = filename.replace(/\.(xlsx|xlsm)$/i, '');
          filename += targetExt;

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();

          // Cleanup
          setTimeout(() => {
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
          }, 100);

          setFsStatus("Download started.");
          setTimeout(() => setFsStatus(null), 3000);

        } catch (e: any) {
          console.error("[EXPORT][XLSM] download failed", e);
          setError("Download failed: " + (e.message || "Unknown error"));
        } finally {
          setDownloading(null);
        }
        return;
      }

      // Explicit XLSX Branch: Browser Download
      if (format === 'xlsx') {
        console.log("[EXPORT][XLSX] bypassing file system picker");
        setError(null);
        setFsStatus("Generating XLSX...");
        const modelIds = Array.from(selectedModels);

        try {
          const response = await exportApi.downloadXlsx(modelIds, listingType);

          let filename = "Amazon_Export.xlsx";
          const disposition = response.headers['content-disposition'];
          if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          } else {
            const mfrName = manufacturers.find(m => m.id === selectedManufacturer)?.name || 'Export';
            filename = `Amazon-${mfrName.replace(/\s+/g, '_')}.xlsx`;
          }

          const sig = response.headers['x-export-signature'];
          const tCode = response.headers['x-export-template-code'];
          if (sig) setLastDownloadSignature(sig);
          if (tCode) setLastDownloadTemplateCode(tCode);

          // XLSX Blob Config
          const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

          if (response.headers['content-type']?.includes('application/json')) {
            const text = await response.data.text();
            throw new Error(`Server returned JSON instead of file: ${text.substring(0, 100)}`);
          }

          if (!filename.toLowerCase().endsWith('.xlsx')) {
            filename += '.xlsx';
          }

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();

          setTimeout(() => {
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
          }, 100);

          setFsStatus("Download started.");
          setTimeout(() => setFsStatus(null), 3000);

        } catch (e: any) {
          console.error("[EXPORT][XLSX] download failed", e);
          setError("Download failed: " + (e.message || "Unknown error"));
        } finally {
          setDownloading(null);
        }
        return;
      }

      // Explicit CSV Branch: Browser Download
      if (format === 'csv') {
        console.log("[EXPORT][CSV] bypassing file system picker");
        setError(null);
        setFsStatus("Generating CSV...");
        const modelIds = Array.from(selectedModels);

        try {
          const response = await exportApi.downloadCsv(modelIds, listingType);

          let filename = "Amazon_Export.csv";
          const disposition = response.headers['content-disposition'];
          if (disposition && disposition.indexOf('attachment') !== -1) {
            const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
            const matches = filenameRegex.exec(disposition);
            if (matches != null && matches[1]) {
              filename = matches[1].replace(/['"]/g, '');
            }
          } else {
            const mfrName = manufacturers.find(m => m.id === selectedManufacturer)?.name || 'Export';
            filename = `Amazon-${mfrName.replace(/\s+/g, '_')}.csv`;
          }

          const sig = response.headers['x-export-signature'];
          const tCode = response.headers['x-export-template-code'];
          if (sig) setLastDownloadSignature(sig);
          if (tCode) setLastDownloadTemplateCode(tCode);

          // CSV Blob Config
          const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });

          if (response.headers['content-type']?.includes('application/json')) {
            const text = await response.data.text();
            throw new Error(`Server returned JSON instead of file: ${text.substring(0, 100)}`);
          }

          if (!filename.toLowerCase().endsWith('.csv')) {
            filename += '.csv';
          }

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', filename);
          document.body.appendChild(link);
          link.click();

          setTimeout(() => {
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
          }, 100);

          setFsStatus("Download started.");
          setTimeout(() => setFsStatus(null), 3000);

        } catch (e: any) {
          console.error("[EXPORT][CSV] download failed", e);
          setError("Download failed: " + (e.message || "Unknown error"));
        } finally {
          setDownloading(null);
        }
        return;
      }

      // REGRESSION GUARD: XLSM/XLSX/CSV must NEVER reach this point.
      // If the above "return" is bypassed, we must fail loudly rather than trigger the Folder Picker.
      if (format === 'xlsm' || format === 'xlsx' || format === 'csv') {
        throw new Error(`[EXPORT][${(format as string).toUpperCase()}] Regression detected: File System API invoked for browser download`);
      }

      setError(null)
      setFsStatus(retryMode ? "Retrying failed files..." : "Checking permissions...")
      if (!retryMode) {
        setWriteResults([])
        setLastSavePlanSnapshot(savePlan) // Snapshot key for retry
        setPostExportImageWarnings([]) // Clear previous run warnings
      }

      // specific reference to plan to use
      const activePlan = retryMode ? (lastSavePlanSnapshot || savePlan) : savePlan

      // Track local results to update state at end (or incrementally if we wanted)
      const currentResults: WriteResult[] = retryMode ? [...writeResults] : []

      let debugCurrentFile = "initialization"

      try {
        let runValidationIssues: ExportValidationIssue[] = []
        // 0. Validation Check (Silent Run during export to ensure we catch image issues)
        // Only run if we don't have a fresh report or if we want to be sure.
        // Given the requirement to capture "validation report used", let's re-run or use existing?
        // Re-running ensures we catch transient HTTP failures.
        setFsStatus("Validating...")
        setFsStatus("Validating...")
        try {
          const freshReport = await getFreshValidationReport()
          // Filter for image failure warnings
          // Look for message containing "Image URL inaccessible" or "Unresolved placeholder"
          runValidationIssues = freshReport.items.filter(i =>
            i.severity === 'warning' &&
            (i.message.includes("Image URL inaccessible") || i.message.includes("Unresolved placeholder"))
          )
        } catch (e) {
          console.warn("Silent validation failed", e)
          // Don't block export on validation crash
        }

        setFsStatus("Writing files...");

        // 1. Ensure Base Folder (load, verify, or pick)
        let dirHandle
        try {
          dirHandle = await getOrPickWritableBaseDirectory(baseDir)
          setBaseDir(dirHandle) // Update state if it changed or verified
        } catch (e: any) {
          // If it's an abort error, just stop silently or show "Cancelled"
          if (e.name === 'AbortError' || e.message?.includes('aborted')) {
            console.log("[EXPORT][FS] picker cancelled");
            setDownloading(null)
            setFsStatus(null)
            return
          }
          throw e // Propagate real errors
        }

        const modelIds = Array.from(selectedModels)

        // Helper to fix extension
        const getExtension = (fmt: string) => fmt === 'xlsx' ? 'xlsx' : fmt === 'xlsm' ? 'xlsm' : 'csv'
        const ext = getExtension(format)
        const fixExt = (name: string) => name.replace(/\.xlsx$/i, `.${ext}`)

        // Helper for verification
        const verifyBlob = async (blob: Blob, headers: any, expectedTemplateCode?: string): Promise<{ verified: boolean, reason?: string }> => {
          try {
            const sigHeader = headers['x-export-signature']
            const tmplHeader = headers['x-export-template-code']

            if (!sigHeader) return { verified: false, reason: "Missing signature header" }

            const ab = await blob.arrayBuffer()
            const hashBuffer = await crypto.subtle.digest('SHA-256', ab)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

            // Header might be hex or base64. Python usually sends hex if we set it up that way, 
            // but standard is often hex for simple sigs. Let's assume hex first as per our backend logic.
            // If backend sends base64, we'd need to convert. 
            // The prompt says "support hex-64 and base64/base64url formats".

            let sigHex = sigHeader.toLowerCase()
            // Simple auto-detect: if it has non-hex chars or ends with =, likely base64. 
            // However, easiest is to check length. SHA256 hex is 64 chars. Base64 is 44 chars.
            if (sigHeader.length !== 64 && /^[a-zA-Z0-9+/=_-]+$/.test(sigHeader)) {
              // Decode base64 to hex
              const binary = atob(sigHeader.replace(/-/g, '+').replace(/_/g, '/'))
              const bytes = new Uint8Array(binary.length)
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
              sigHex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
            }

            if (hashHex !== sigHex) {
              return { verified: false, reason: "Hash mismatch (corrupt download)" }
            }

            if (expectedTemplateCode && tmplHeader && expectedTemplateCode !== tmplHeader) {
              return { verified: false, reason: `Template mismatch (Server used ${tmplHeader}, expected ${expectedTemplateCode})` }
            }

            return { verified: true }
          } catch (e: any) {
            return { verified: false, reason: "Verification error: " + e.message }
          }
        }

        setFsStatus("Writing files...");

        // Helper to update result list
        const updateResult = (key: string, filename: string, status: 'success' | 'failed', error?: string, warning?: string, verifyResult?: { verified: boolean, reason?: string }) => {
          const idx = currentResults.findIndex(r => r.key === key)
          const entry: WriteResult = {
            key,
            filename,
            status,
            errorMessage: error,
            warning,
            verified: verifyResult?.verified,
            verificationReason: verifyResult?.reason
          }

          if (idx >= 0) {
            currentResults[idx] = entry
          } else {
            currentResults.push(entry)
          }
          setWriteResults([...currentResults])
        }

        // Helper to check if we should process this key (for retry logic)
        const shouldProcess = (key: string) => {
          if (!retryMode) return true
          const existing = writeResults.find(r => r.key === key)
          return existing?.status === 'failed'
        }

        if (activePlan?.type === 'multi') {
          // Master
          const masterKey = 'master'
          if (shouldProcess(masterKey)) {
            setFsStatus("Processing Master File...")
            try {
              // Fetch Master Blob
              let masterRes;
              if (format === 'xlsx') masterRes = await exportApi.downloadXlsx(modelIds, listingType)
              else if (format === 'xlsm') masterRes = await exportApi.downloadXlsm(modelIds, listingType)
              else masterRes = await exportApi.downloadCsv(modelIds, listingType)

              const sig = masterRes.headers['x-export-signature']
              const tCode = masterRes.headers['x-export-template-code']
              if (sig) setLastDownloadSignature(sig)
              if (tCode) setLastDownloadTemplateCode(tCode)

              const masterFolderParts = activePlan.master!.folder.split(/[\\/]/).filter((p: string) => p)
              const masterDir = await ensureSubdirectory(dirHandle, masterFolderParts)

              debugCurrentFile = "Master File (" + activePlan.master!.filename + ")"
              const result = await writeFileAtomic(masterDir, fixExt(activePlan.master!.filename), new Blob([masterRes.data]))
              if (result.warning) console.warn(result.warning)

              // Verify
              const ver = await verifyBlob(new Blob([masterRes.data]), masterRes.headers) // Pass blob again or reuse? Reuse ideally but blob is cheap pointer usually.

              updateResult(masterKey, activePlan.master!.filename, 'success', undefined, result.warning, ver)
            } catch (e: any) {
              console.error("Master write failed", e)
              updateResult(masterKey, activePlan.master!.filename, 'failed', e.message || 'Write failed')
            }
          }

          // Children
          let count = 0
          for (const child of activePlan.children!) {
            count++
            const childKey = `series-${(child as any).seriesId}`

            if (!shouldProcess(childKey)) continue

            setFsStatus(`Writing Series ${count}/${activePlan.children!.length}: ${child.filename}...`)

            const childSeriesId = (child as any).seriesId
            if (!childSeriesId) continue

            const childModels = modelIds.filter(mid => {
              const m = allModels.find(am => am.id === mid)
              return m?.series_id === childSeriesId
            })

            if (childModels.length === 0) continue

            try {
              let childRes;
              if (format === 'xlsx') childRes = await exportApi.downloadXlsx(childModels, listingType)
              else if (format === 'xlsm') childRes = await exportApi.downloadXlsm(childModels, listingType)
              else childRes = await exportApi.downloadCsv(childModels, listingType)

              const childFolderParts = child.folder.split(/[\\/]/).filter((p: string) => p)
              const childDir = await ensureSubdirectory(dirHandle, childFolderParts)

              debugCurrentFile = "Series File (" + child.filename + ")"
              const result = await writeFileAtomic(childDir, fixExt(child.filename), new Blob([childRes.data]))
              if (result.warning) console.warn(result.warning)

              // Verify
              const ver = await verifyBlob(new Blob([childRes.data]), childRes.headers)

              updateResult(childKey, child.filename, 'success', undefined, result.warning, ver)
            } catch (e: any) {
              console.error(`Series ${childSeriesId} write failed`, e)
              updateResult(childKey, child.filename, 'failed', e.message || 'Write failed')
            }
          }

        } else if (activePlan?.type === 'single') {
          const key = 'single'
          if (shouldProcess(key)) {
            setFsStatus("Writing file...")
            try {
              let res;
              if (format === 'xlsx') res = await exportApi.downloadXlsx(modelIds, listingType)
              else if (format === 'xlsm') res = await exportApi.downloadXlsm(modelIds, listingType)
              else res = await exportApi.downloadCsv(modelIds, listingType)

              const sig = res.headers['x-export-signature']
              const tCode = res.headers['x-export-template-code']
              if (sig) setLastDownloadSignature(sig)
              if (tCode) setLastDownloadTemplateCode(tCode)

              const folderParts = activePlan.plan!.folder.split(/[\\/]/).filter((p: string) => p)
              const dir = await ensureSubdirectory(dirHandle, folderParts)

              debugCurrentFile = activePlan.plan!.filename
              const result = await writeFileAtomic(dir, fixExt(activePlan.plan!.filename), new Blob([res.data]))
              if (result.warning) console.warn(result.warning)

              // Verify
              const ver = await verifyBlob(new Blob([res.data]), res.headers)

              updateResult(key, activePlan.plan!.filename, 'success', undefined, result.warning, ver)
            } catch (e: any) {
              console.error("Single write failed", e)
              updateResult(key, activePlan.plan!.filename, 'failed', e.message || 'Write failed')
            }
          }
        } else {
          throw new Error("No Save Plan available")
        }

        // Final Status Update
        const failureCount = currentResults.filter(r => r.status === 'failed').length

        // Trigger Image Warning Popup if any
        if (runValidationIssues.length > 0) {
          setPostExportImageWarnings(runValidationIssues)
        }

        if (failureCount > 0) {
          setFsStatus(`Completed with ${failureCount} errors.`)
        } else {
          setFsStatus("All files saved successfully!")
          setTimeout(() => setFsStatus(null), 5000)
        }

      } catch (err: any) {
        console.error(err)
        setError(`File System Error (at ${debugCurrentFile}): ` + (err.message || 'Unknown error'))
        setFsStatus(null)
      } finally {
        setDownloading(null)
      }
    } catch (err: any) {
      console.error(`[EXPORT][${format.toUpperCase()}] click: failed`, err);
      if (err instanceof DOMException) {
        console.error(`[EXPORT][${format.toUpperCase()}] DOMException`, { name: err.name, message: err.message });
      }
      throw err;
    }
  }

  const allSelected = filteredModels.length > 0 && filteredModels.every(m => selectedModels.has(m.id))
  const someSelected = filteredModels.some(m => selectedModels.has(m.id))

  const sortedManufacturers = useMemo(() => {
    return [...manufacturers].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
  }, [manufacturers])


  if (loadError) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, maxWidth: 600, textAlign: 'center', borderColor: 'error.main', border: 1 }}>
          <ErrorIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
          <Typography variant="h5" color="error" gutterBottom>
            Initialization Failed
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            The export page could not load required data.
          </Typography>
          <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1, textAlign: 'left' }}>
            <Typography variant="caption" display="block"><strong>Step:</strong> {loadStep}</Typography>
            <Typography variant="caption" display="block" color="error"><strong>Error:</strong> {loadError}</Typography>
          </Box>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </Paper>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400, flexDirection: 'column', gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">{loadStep}</Typography>
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


      {/* Save Plan Display (disabled: downloads are browser-managed) */}
      {false && savePlan && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" color="primary">
              Settings: Proposed Save Plan
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {baseDir ? (
                <>
                  <Chip
                    label={`Saving to: ${baseDir.name}`}
                    icon={<FolderOpenIcon />}
                    color="success"
                    variant="outlined"
                    onClick={() => pickBaseDirectory().then(h => setBaseDir(h))}
                  />
                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={async () => {
                      await clearPersistedHandle()
                      setBaseDir(null)
                    }}
                  >
                    Reset Saved Folder
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  startIcon={<FolderOpenIcon />}
                  onClick={() => pickBaseDirectory().then(h => setBaseDir(h))}
                  variant="outlined"
                >
                  Choose Output Folder
                </Button>
              )}
            </Box>
          </Box>

          {fsStatus && (
            <Alert severity="info" sx={{ mb: 1 }}>{fsStatus}</Alert>
          )}

          {/* Write Summary */}
          {writeResults.length > 0 && (
            <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: '#fff', border: '1px solid #eee', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Export Summary ({writeResults.filter(r => r.status === 'success').length}/{writeResults.length} successful)</span>
                <Button
                  size="small"
                  onClick={() => {
                    setWriteResults([])
                    setLastSavePlanSnapshot(null)
                    setFsStatus(null)
                    setPostExportImageWarnings([])

                    // Clear Validation Cache on explicit clear
                    setLastValidationKey(null)
                    setLastValidationAtMs(null)
                    setValidationReport(null)
                  }}
                >
                  Clear
                </Button>
              </Typography>

              {/* UI: Success List + Verification */}
              <Box sx={{ maxHeight: 200, overflowY: 'auto', mb: 2 }}>
                {writeResults.filter(r => r.status === 'success').map(r => (
                  <Box key={r.key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    {r.verified ? (
                      <VerifiedUserIcon color="success" fontSize="small" titleAccess="Verified: Signature Matches" />
                    ) : (
                      <GppBadIcon color="error" fontSize="small" titleAccess={r.verificationReason || "Verification Failed"} />
                    )}
                    <Typography variant="caption" sx={{ flexGrow: 1 }}>
                      {r.filename}
                    </Typography>
                    {!r.verified && (
                      <Typography variant="caption" color="error">
                        {r.verificationReason}
                      </Typography>
                    )}
                    {r.warning && (
                      <Typography variant="caption" color="warning.main">
                        (Cleanup Warning: {r.warning})
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>


              {writeResults.filter(r => r.status === 'failed').length > 0 && (
                <Box>
                  <Alert severity="error" sx={{ mb: 1 }}>
                    {writeResults.filter(r => r.status === 'failed').length} files failed to save.
                  </Alert>
                  <Box sx={{ maxHeight: 150, overflowY: 'auto', mb: 1 }}>
                    {writeResults.filter(r => r.status === 'failed').map(r => (
                      <Typography key={r.key} variant="caption" color="error" display="block">
                        • {r.filename}: {r.errorMessage}
                      </Typography>
                    ))}
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    onClick={() => {
                      handleFileSystemDownload('xlsx', true)
                    }}
                  >
                    Retry Failed Files
                  </Button>
                  <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                    (Retries using XLSX as default)
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {savePlan ? (savePlan!.type === 'single' ? (
            <Box>
              <Typography variant="body2"><strong>Folder:</strong> {savePlan!.plan!.folder}</Typography>
              <Typography variant="body2"><strong>File:</strong> {savePlan!.plan!.filename}</Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}><strong>Master File:</strong></Typography>
              <Box sx={{ pl: 2, mb: 2, borderLeft: '2px solid #ddd' }}>
                <Typography variant="body2">Folder: {savePlan!.master!.folder}</Typography>
                <Typography variant="body2">File: {savePlan!.master!.filename}</Typography>
              </Box>

              <Typography variant="body2" sx={{ mb: 1 }}><strong>Per-Series Files ({savePlan!.children!.length}):</strong></Typography>
              <Box sx={{ pl: 2, maxHeight: 100, overflowY: 'auto', borderLeft: '2px solid #ddd' }}>
                {savePlan!.children?.map((child, i) => (
                  <Box key={i} sx={{ mb: 1 }}>
                    <Typography variant="caption" display="block">Folder: {child.folder}</Typography>
                    <Typography variant="caption" display="block">File: {child.filename}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )) : null}
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {missingSnapshots && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setMissingSnapshots(null)}>
          <Typography variant="subtitle2">Missing Baseline Pricing Snapshots</Typography>
          <Typography variant="body2">The following variants must be calculated before generating a preview:</Typography>
          <Box sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
            {Object.entries(missingSnapshots).map(([mid, variants]) => {
              const model = allModels.find(m => m.id === Number(mid))
              return (
                <div key={mid}>
                  <strong>{model?.name || `Model ${mid}`}</strong>: {variants.join(', ')}
                </div>
              )
            })}
          </Box>
          <Button color="inherit" size="small" sx={{ mt: 1 }} onClick={handleRecalcAndPreview} disabled={recalculating}>
            {recalculating ? 'Fixing...' : 'Run Recalculate Now'}
          </Button>
        </Alert>
      )}

      {/* Export Settings Panel */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Export Settings (Amazon)</Typography>
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Default Save Path Template"
              value={localSavePathTemplate}
              onChange={(e) => setLocalSavePathTemplate(e.target.value)}
              helperText={
                <span>
                  Note: This does not control where the browser downloads files. Downloads still go to your browser’s default Downloads folder unless you change browser settings.<br />
                  Supported Placeholders: [Marketplace], [Manufacturer_Name], [Series_Name]
                </span>
              }
              size="small"
            />
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeCustomization}
                    onChange={(e) => setIncludeCustomization(e.target.checked)}
                    size="small"
                  />
                }
                label="Include Customization"
              />
            </Box>
            <Box sx={{ mt: 2 }}>
              <FormControl component="fieldset">
                <FormLabel component="legend" sx={{ fontSize: '0.875rem' }}>Customization Export Format</FormLabel>
                <RadioGroup
                  row
                  value={localCustomizationFormat}
                  onChange={(e) => setLocalCustomizationFormat(e.target.value)}
                >
                  <FormControlLabel
                    value="xlsx"
                    control={<Radio size="small" />}
                    label={<Typography variant="body2">Excel (.xlsx) — Recommended</Typography>}
                  />
                  <FormControlLabel
                    value="txt"
                    control={<Radio size="small" />}
                    label={<Typography variant="body2">Unicode Text (.txt) — Legacy</Typography>}
                  />
                </RadioGroup>
                {includeCustomization && localCustomizationFormat === 'txt' ? (
                  <Alert
                    severity="warning"
                    sx={{ mt: 1 }}
                    action={
                      <Button
                        size="small"
                        onClick={async () => {
                          const text =
                            "To avoid blank TXT exports:\n" +
                            "1) Open the customization template in Excel\n" +
                            "2) Force recalculation (Ctrl+Alt+F9)\n" +
                            "3) Save the file\n"

                          try {
                            await navigator.clipboard.writeText(text)
                            setCustCopyCopied(true)
                            window.setTimeout(() => setCustCopyCopied(false), 1500)
                          } catch {
                            // Clipboard may be blocked in some environments; still no-op per guardrails.
                          }
                        }}
                      >
                        {custCopyCopied ? 'Copied!' : 'Copy steps'}
                      </Button>
                    }
                  >
                    <Stack spacing={0.5}>
                      <Typography variant="body2">
                        TXT generation reads cached cell values (formulas may export blank unless the template was recalculated and saved in Excel).
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        To avoid blanks:
                      </Typography>
                      <Typography variant="body2">1) Open the template in Excel</Typography>
                      <Typography variant="body2">2) Force recalculation (Ctrl+Alt+F9)</Typography>
                      <Typography variant="body2">3) Save the file</Typography>
                    </Stack>
                  </Alert>
                ) : null}
              </FormControl>
            </Box>
            <Box sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', borderRadius: 1, border: '1px solid #e0e0e0' }}>
              {!includeCustomization ? (
                <Typography variant="body2" color="text.secondary">Customization is disabled.</Typography>
              ) : missingTemplateNames.length > 0 ? (
                <>
                  <Typography variant="body2" color="error" sx={{ mb: 1, fontWeight: 500 }}>
                    Customization is enabled, but these equipment types are missing an assigned customization template:
                  </Typography>
                  <ul style={{ margin: '4px 0 12px 20px', padding: 0, fontSize: '0.875rem' }}>
                    {missingTemplateNames.map(name => <li key={name}>{name}</li>)}
                  </ul>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    The customization file will not be included.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      component={RouterLink}
                      to="/templates"
                      size="small"
                      variant="outlined"
                      color="primary"
                    >
                      Manage templates
                    </Button>
                    <Button
                      component={RouterLink}
                      to="/templates?focus=customization&scroll=linking"
                      size="small"
                      variant="contained"
                      color="warning"
                    >
                      Fix missing templates
                    </Button>
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="success.main" sx={{ fontWeight: 500 }}>
                  Customization file will be included as: {localCustomizationFormat.toUpperCase()}
                </Typography>
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Button variant="contained" onClick={handleSaveExportSettings} sx={{ height: 40 }}>
              Save Configuration
            </Button>
          </Grid>
        </Grid>
      </Paper>

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
                  setMissingSnapshots(null)
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
                value={selectedSeries}
                label="Series"
                onChange={(e) => {
                  const newSeriesId = e.target.value as number | ''
                  setSelectedSeries(newSeriesId)
                  setMissingSnapshots(null)

                  // Auto-select ONLY when a specific series is chosen (Series-first workflow)
                  if (newSeriesId) {
                    const modelsInSeries = allModels.filter(m => m.series_id === newSeriesId)
                    setSelectedModels(new Set(modelsInSeries.map(m => m.id)))
                  } else {
                    // Reset selection when series is cleared (Manufacturer-wide view)
                    setSelectedModels(new Set())
                  }
                }}
                disabled={!selectedManufacturer}
              >
                <MenuItem value="">All Series</MenuItem>
                {sortedSeries.map(s => (
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
                variant="outlined"
                color="secondary"
                size="small"
                startIcon={<RefreshIcon />}
                onClick={handleRecalculateSelected}
                disabled={selectedModels.size === 0 || recalculating}
              >
                {recalculating ? 'Recalculating...' : 'Recalc Prices'}
              </Button>
              <Button
                variant="contained"
                startIcon={<PreviewIcon />}
                onClick={handleGeneratePreview}
                disabled={selectedModels.size === 0 || generating}
              >
                {generating ? 'Generating...' : 'Generate Preview'}
              </Button>
              <Button
                variant="outlined"
                color="info"
                size="small"
                startIcon={<FactCheckIcon />}
                onClick={handleValidateExport}
                disabled={selectedModels.size === 0 || validating}
              >
                {validating ? 'Checking...' : 'Readiness Report'}
              </Button>
            </Box>
          </Grid>
        </Grid>

        {/* Validation Report UI */}
        {validationReport && (
          <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: '#fafafa' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Export Readiness Report
              {validationReport.status === 'valid' && <Chip label="Ready" color="success" size="small" icon={<CheckCircleIcon />} />}
              {validationReport.status === 'warnings' && <Chip label="Warnings" color="warning" size="small" icon={<WarningIcon />} />}
              {validationReport.status === 'errors' && <Chip label="Not Ready" color="error" size="small" icon={<ErrorIcon />} />}
            </Typography>

            <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
              <Typography variant="body2"><strong>Models Checked:</strong> {validationReport.summary_counts.total_models}</Typography>
              <Typography variant="body2" color="error.main"><strong>Errors:</strong> {validationReport.summary_counts.errors || 0}</Typography>
              <Typography variant="body2" color="warning.main"><strong>Warnings:</strong> {validationReport.summary_counts.warnings || 0}</Typography>
            </Box>

            {validationReport.status === 'errors' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                Critical issues found. Export is disabled until these are resolved.
              </Alert>
            )}

            {validationReport.items.length > 0 ? (
              <Box sx={{ maxHeight: 200, overflowY: 'auto', bgcolor: 'white', border: '1px solid #eee', p: 1 }}>
                {validationReport.items.map((item, idx) => (
                  <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 0.5, alignItems: 'flex-start' }}>
                    {item.severity === 'error' ? <ErrorIcon color="error" fontSize="small" sx={{ mt: 0.3 }} /> : <WarningIcon color="warning" fontSize="small" sx={{ mt: 0.3 }} />}
                    <Box>
                      <Typography variant="body2" color={item.severity === 'error' ? 'error' : 'text.primary'}>
                        {item.model_name ? <strong>{item.model_name}: </strong> : ''}{item.message}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No issues found.</Typography>
            )}
          </Box>
        )}

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
        <Box sx={{ px: 1, py: 1, borderBottom: '1px solid #f0f0f0', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            {!selectedManufacturer
              ? "Select a manufacturer to view models."
              : !selectedSeries
                ? `Showing all models for ${manufacturers.find(m => m.id === selectedManufacturer)?.name || 'Manufacturer'} (all series)`
                : `Showing models for ${manufacturers.find(m => m.id === selectedManufacturer)?.name || 'Manufacturer'} → ${allSeries.find(s => s.id === selectedSeries)?.name || 'Series'}`
            }
          </Typography>
        </Box>
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
            <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item>
                  <Typography variant="subtitle2">Verification Status:</Typography>
                </Grid>
                <Grid item>
                  {lastDownloadSignature ? (
                    lastDownloadSignature === previewData.export_signature ? (
                      <Chip label="✅ Verified: Download matches Preview" color="success" size="small" />
                    ) : (
                      <Chip label="❌ Mismatch: Download differs from Preview" color="error" size="small" />
                    )
                  ) : (
                    <Chip label="Waiting for download..." size="small" variant="outlined" />
                  )}
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" display="block">Preview Signature:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {previewData.export_signature || "—"}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" display="block">Downloaded Signature:</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {lastDownloadSignature || "—"}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" display="block">Template Code (Preview):</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {previewData.template_code}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" display="block">Template Code (Download):</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {lastDownloadTemplateCode || "—"}
                  </Typography>
                </Grid>
              </Grid>

              {previewData.audit && (
                <Accordion sx={{ mt: 2, bgcolor: 'white', '&:before': { display: 'none' } }} elevation={1}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box>
                      <Typography variant="subtitle2">Why these values?</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Explains which template columns were filled and the source rules.
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" display="block" color="text.secondary" gutterBottom>ROW MODE</Typography>
                      <Chip
                        label={previewData.audit.row_mode}
                        size="small"
                        color="default"
                        variant="outlined"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </Box>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="caption" display="block" color="text.secondary" gutterBottom>PRICING MAPPING</Typography>
                      {previewData.audit.pricing.matched_price_fields.length > 0 ? (
                        previewData.audit.pricing.matched_price_fields.map((field) => (
                          <Box key={field.column_index} sx={{ mb: 1, p: 1, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              Column {field.column_index}: {field.field_name}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                              {field.rule_explanation}
                            </Typography>
                            {field.source && (
                              <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                                <Chip label={field.source.marketplace} size="small" sx={{ height: 20, fontSize: '0.625rem' }} />
                                <Chip label={field.source.variant_key} size="small" sx={{ height: 20, fontSize: '0.625rem' }} />
                              </Box>
                            )}
                          </Box>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No price fields detected in this template.
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="caption" display="block" color="text.secondary" gutterBottom>SKU MAPPING</Typography>
                      {previewData.audit.sku.matched_sku_fields.length > 0 ? (
                        previewData.audit.sku.matched_sku_fields.map((field) => (
                          <Box key={field.column_index} sx={{ mb: 1, p: 1, bgcolor: '#f8f9fa', borderRadius: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              Column {field.column_index}: {field.field_name}
                            </Typography>
                            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                              {field.rule_explanation}
                            </Typography>
                          </Box>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No SKU fields detected in this template.
                        </Typography>
                      )}
                    </Box>

                    <Box>
                      <Typography variant="caption" display="block" color="text.secondary" gutterBottom>SAMPLE ROWS (AUDITED VALUES)</Typography>
                      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontSize: '11px', fontWeight: 'bold' }}>Model ID</TableCell>
                              <TableCell sx={{ fontSize: '11px', fontWeight: 'bold' }}>Model Name</TableCell>
                              <TableCell sx={{ fontSize: '11px', fontWeight: 'bold' }}>Audited Values</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {previewData.audit.row_samples.map((sample) => (
                              <TableRow key={sample.model_id}>
                                <TableCell sx={{ fontSize: '11px' }}>{sample.model_id}</TableCell>
                                <TableCell sx={{ fontSize: '11px' }}>{sample.model_name}</TableCell>
                                <TableCell sx={{ fontSize: '11px' }}>
                                  {Object.entries(sample.key_values).map(([key, val]) => (
                                    <Box key={key} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                                      <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#555' }}>
                                        {key}:
                                      </Typography>
                                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                        {val}
                                      </Typography>
                                    </Box>
                                  ))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
            <Box sx={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(85vh - 350px)' }}>
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
                  {previewData.rows.map((row) => (
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
          <DialogActions sx={{
            px: 3,
            py: 3,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 4,
            borderTop: '1px solid #ddd',
            bgcolor: '#f8f9fa'
          }}>
            {!validationReport || validationReport.status !== 'errors' ? (
              <>
                {/* LEFT: Customization */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Customization Template Export
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => alert("Customization export will be wired next.")}
                      disabled={downloading !== null}
                    >
                      TXT
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => alert("Customization export will be wired next.")}
                      disabled={downloading !== null}
                    >
                      XLSX
                    </Button>
                  </Box>
                </Box>

                {/* CENTER: Zip Package */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={includeCustomization}
                        onChange={(e) => setIncludeCustomization(e.target.checked)}
                      />
                    }
                    label={<Typography variant="caption" sx={{ fontWeight: 500 }}>Include Customization in ZIP</Typography>}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={<DownloadIcon />}
                    onClick={handleZipDownload}
                    disabled={downloading !== null}
                    sx={{ px: 4, py: 1, fontWeight: 'bold' }}
                  >
                    {downloading === 'zip' ? 'Zipping...' : 'DOWNLOAD ZIP PACKAGE'}
                  </Button>
                </Box>

                {/* RIGHT: Product Template */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Product Template Export
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleFileSystemDownload('csv')}
                      disabled={downloading !== null}
                    >
                      {downloading === 'csv' ? '...' : 'CSV'}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleFileSystemDownload('xlsm')} // Using existing XLSM logic as requested
                      disabled={downloading !== null}
                    >
                      {downloading === 'xlsm' ? '...' : 'XLSX'}
                    </Button>
                  </Box>
                </Box>
              </>
            ) : (
              <Box sx={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center' }}>
                <Button disabled color="error" variant="contained">
                  Fix Export Errors to Download
                </Button>
              </Box>
            )}
          </DialogActions>
        </Dialog>
      )}

      {/* Image Failure Warnings Popup */}
      <Dialog
        open={postExportImageWarnings.length > 0}
        onClose={() => setPostExportImageWarnings([])}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
          <WarningIcon />
          Export Completed with Image Warnings
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Some sampled image URLs were inaccessible or invalid. The export files were saved, but these images may be broken on Amazon.
          </Alert>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Model</TableCell>
                  <TableCell>Issue</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {postExportImageWarnings.map((issue, idx) => {
                  // Extract URL if present in message "Image URL inaccessible (...): URL"
                  const urlMatch = issue.message.match(/: (http.*)$/)
                  const url = urlMatch ? urlMatch[1] : null
                  return (
                    <TableRow key={idx}>
                      <TableCell>{issue.model_name || `ID ${issue.model_id}`}</TableCell>
                      <TableCell sx={{ wordBreak: 'break-word', fontSize: '0.85rem' }}>
                        {issue.message}
                      </TableCell>
                      <TableCell align="right">
                        {url && (
                          <Tooltip title="Copy URL">
                            <IconButton size="small" onClick={() => navigator.clipboard.writeText(url)}>
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPostExportImageWarnings([])} color="primary" variant="contained">
            Acknowledge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
