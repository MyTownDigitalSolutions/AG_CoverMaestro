import { useEffect, useState } from 'react'
import {
    Box, Typography, Paper, FormControl, InputLabel, Select, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TextField, Button, Alert, Snackbar, Grid, CircularProgress, InputAdornment,
    Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Checkbox, FormControlLabel, Tooltip
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import ArchiveIcon from '@mui/icons-material/Archive'
import RestoreIcon from '@mui/icons-material/RestoreFromTrash'
import { settingsApi } from '../services/api'
import type { ShippingRateCard, ShippingRateTier, ShippingZoneRateNormalized } from '../types'

export default function ShippingRatesPage() {
    const [rateCards, setRateCards] = useState<ShippingRateCard[]>([])
    const [tiers, setTiers] = useState<ShippingRateTier[]>([])
    const [zoneRates, setZoneRates] = useState<ShippingZoneRateNormalized[]>([])

    const [selectedCardId, setSelectedCardId] = useState<number | ''>('')
    const [selectedTierId, setSelectedTierId] = useState<number | ''>('')

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    // Rate Card CRUD State
    const [showArchived, setShowArchived] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<'create' | 'rename' | 'archive' | 'restore'>('create')
    const [dialogValue, setDialogValue] = useState('') // Name input

    // Tier CRUD State
    const [showArchivedTiers, setShowArchivedTiers] = useState(false)
    const [tierDialogOpen, setTierDialogOpen] = useState(false)
    const [tierDialogMode, setTierDialogMode] = useState<'create' | 'edit' | 'archive' | 'restore'>('create')
    const [tierLabel, setTierLabel] = useState('')
    const [tierMaxWeight, setTierMaxWeight] = useState('')

    // Load Rate Cards
    useEffect(() => {
        loadRateCards()
    }, [showArchived])

    const loadRateCards = () => {
        settingsApi.listRateCards(showArchived)
            .then(cards => {
                setRateCards(cards)
                // If selected card is no longer in list (e.g. archived and hidden), deselect
                if (selectedCardId && !cards.find(c => c.id === selectedCardId)) {
                    setSelectedCardId('')
                    setSelectedTierId('')
                }
            })
            .catch(err => console.error("Failed to load rate cards", err))
    }

    // Load Tiers when Card changes or showArchivedTiers changes
    useEffect(() => {
        if (selectedCardId) {
            setLoading(true)
            settingsApi.listTiers(selectedCardId as number, showArchivedTiers)
                .then(data => {
                    // Sort tiers generally by weight
                    const sorted = [...data].sort((a, b) => a.min_oz - b.min_oz)
                    setTiers(sorted)
                    // If selected tier missing, deselect
                    if (selectedTierId && !sorted.find(t => t.id === selectedTierId)) {
                        setSelectedTierId('')
                    }
                })
                .catch(err => console.error("Failed to load tiers", err))
                .finally(() => setLoading(false))
        } else {
            setTiers([])
        }
    }, [selectedCardId, showArchivedTiers])

    // Load Zone Rates when Tier changes
    useEffect(() => {
        if (selectedTierId) {
            loadZoneRates(selectedTierId as number)
        } else {
            setZoneRates([])
        }
    }, [selectedTierId])

    const loadZoneRates = (tierId: number) => {
        setLoading(true)
        settingsApi.listZoneRates(tierId)
            .then(setZoneRates)
            .catch(err => {
                console.error("Failed to load zone rates", err)
                setMessage({ type: 'error', text: 'Failed to load rates' })
            })
            .finally(() => setLoading(false))
    }

    // To allow smooth typing of decimals, ideally we should have a local string map.
    // But for this "minimal" task, passing value={(r.rate_cents / 100).toFixed(2)} forces formatting on every render.
    // This causes cursor jumps.
    // I will introduce a local edit state map: { [zoneId]: string }
    const [localValues, setLocalValues] = useState<Record<number, string>>({})

    // Sync edits when zoneRates loads
    useEffect(() => {
        const initial: Record<number, string> = {}
        zoneRates.forEach(r => {
            initial[r.zone_id] = r.rate_cents !== null ? (r.rate_cents / 100).toFixed(2) : ''
        })
        setLocalValues(initial)
    }, [zoneRates])

    const handleLocalChange = (zoneId: number, val: string) => {
        setLocalValues(prev => ({ ...prev, [zoneId]: val }))
    }

    const handleSave = async () => {
        if (!selectedTierId) return
        setSaving(true)
        setMessage(null)

        try {
            // Find changed rows
            const updates = zoneRates.map(r => {
                const newVal = localValues[r.zone_id]
                // If undefined, touched nothing, keep existing
                if (newVal === undefined) return null

                const originalCents = r.rate_cents
                let newCents: number | null = null

                if (newVal.trim() !== '') {
                    const f = parseFloat(newVal)
                    if (isNaN(f)) return null // Invalid input, skip or could throw error
                    newCents = Math.round(f * 100)
                }

                if (originalCents !== newCents) {
                    return settingsApi.upsertTierZoneRate(selectedTierId as number, r.zone_id, newCents)
                }
                return null
            }).filter(Boolean)

            if (updates.length > 0) {
                await Promise.all(updates)
                setMessage({ type: 'success', text: 'Rates saved successfully' })
                await loadZoneRates(selectedTierId as number)
            } else {
                setMessage({ type: 'success', text: 'No changes detected' })
            }

        } catch (err) {
            console.error("Failed to save", err)
            setMessage({ type: 'error', text: 'Failed to save changes' })
        } finally {
            setSaving(false)
        }
    }

    const handleOpenCreate = () => {
        setDialogMode('create')
        setDialogValue('')
        setDialogOpen(true)
    }

    const handleOpenRename = () => {
        const card = rateCards.find(c => c.id === selectedCardId)
        if (!card) return
        setDialogMode('rename')
        setDialogValue(card.name)
        setDialogOpen(true)
    }

    const handleOpenArchive = () => {
        setDialogMode('archive')
        setDialogOpen(true)
    }

    const handleOpenRestore = () => {
        setDialogMode('restore')
        setDialogOpen(true)
    }

    const handleDialogSubmit = async () => {
        try {
            if (dialogMode === 'create') {
                if (!dialogValue.trim()) return
                const newCard = await settingsApi.createRateCard({ name: dialogValue })
                setRateCards(prev => [...prev, newCard])
                setSelectedCardId(newCard.id)
                setSelectedTierId('')
                setMessage({ type: 'success', text: 'Rate card created' })
            } else if (dialogMode === 'rename') {
                if (!selectedCardId) return
                if (!dialogValue.trim()) return
                await settingsApi.updateRateCard(selectedCardId as number, { name: dialogValue })
                setRateCards(prev => prev.map(c => c.id === selectedCardId ? { ...c, name: dialogValue } : c))
                setMessage({ type: 'success', text: 'Rate card renamed' })
            } else if (dialogMode === 'archive') {
                if (!selectedCardId) return
                await settingsApi.deleteRateCard(selectedCardId as number)
                setMessage({ type: 'success', text: 'Rate card archived' })
                loadRateCards()
            } else if (dialogMode === 'restore') {
                if (!selectedCardId) return
                await settingsApi.updateRateCard(selectedCardId as number, { active: true })
                setMessage({ type: 'success', text: 'Rate card restored' })
                loadRateCards()
            }
            setDialogOpen(false)
        } catch (err: any) {
            console.error(err)
            setMessage({ type: 'error', text: err.response?.data?.detail || 'Operation failed' })
        }
    }

    const getSelectedCard = () => rateCards.find(c => c.id === selectedCardId)

    const getSelectedTier = () => tiers.find(t => t.id === selectedTierId)

    const handleOpenTierCreate = () => {
        setTierDialogMode('create')
        setTierLabel('')
        setTierMaxWeight('')
        setTierDialogOpen(true)
    }

    const handleOpenTierEdit = () => {
        const tier = tiers.find(t => t.id === selectedTierId)
        if (!tier) return
        setTierDialogMode('edit')
        setTierLabel(tier.label || '')
        setTierMaxWeight(tier.max_oz.toString())
        setTierDialogOpen(true)
    }

    const handleOpenTierArchive = () => {
        setTierDialogMode('archive')
        setTierDialogOpen(true)
    }

    const handleOpenTierRestore = () => {
        setTierDialogMode('restore')
        setTierDialogOpen(true)
    }

    const handleTierDialogSubmit = async () => {
        if (!selectedCardId) return
        try {
            if (tierDialogMode === 'create') {
                if (!tierMaxWeight) return
                const finalLabel = tierLabel.trim() || `${tierMaxWeight} oz`
                const newTier = await settingsApi.createTier(selectedCardId as number, {
                    label: finalLabel,
                    max_weight_oz: parseFloat(tierMaxWeight)
                })
                // Refresh tiers
                const updatedTiers = await settingsApi.listTiers(selectedCardId as number, showArchivedTiers)
                const sorted = [...updatedTiers].sort((a, b) => a.min_oz - b.min_oz)
                setTiers(sorted)
                setSelectedTierId(newTier.id) // Auto select
                setMessage({ type: 'success', text: 'Tier created' })
            } else if (tierDialogMode === 'edit') {
                if (!selectedTierId) return
                await settingsApi.updateTier(selectedTierId as number, {
                    label: tierLabel,
                    max_weight_oz: parseFloat(tierMaxWeight)
                })
                setMessage({ type: 'success', text: 'Tier updated' })
                // Refresh
                const updatedTiers = await settingsApi.listTiers(selectedCardId as number, showArchivedTiers)
                setTiers([...updatedTiers].sort((a, b) => a.min_oz - b.min_oz))
            } else if (tierDialogMode === 'archive') {
                if (!selectedTierId) return
                await settingsApi.deleteTier(selectedTierId as number)
                setMessage({ type: 'success', text: 'Tier archived' })
                setSelectedTierId('') // Clear selection
                // Refresh
                const updatedTiers = await settingsApi.listTiers(selectedCardId as number, showArchivedTiers)
                setTiers([...updatedTiers].sort((a, b) => a.min_oz - b.min_oz))
            } else if (tierDialogMode === 'restore') {
                if (!selectedTierId) return
                await settingsApi.updateTier(selectedTierId as number, { active: true })
                setMessage({ type: 'success', text: 'Tier restored' })
                // Refresh
                const updatedTiers = await settingsApi.listTiers(selectedCardId as number, showArchivedTiers)
                setTiers([...updatedTiers].sort((a, b) => a.min_oz - b.min_oz))
            }
            setTierDialogOpen(false)
        } catch (err: any) {
            console.error(err)
            setMessage({ type: 'error', text: err.response?.data?.detail || 'Operation failed' })
        }
    }

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Shipping Rates Editor</Typography>

            <Grid container spacing={3} sx={{ mb: 4 }} alignItems="center">
                <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Rate Card</InputLabel>
                            <Select
                                value={selectedCardId}
                                label="Rate Card"
                                onChange={(e) => {
                                    setSelectedCardId(e.target.value as number)
                                    setSelectedTierId('') // Reset tier
                                }}
                            >
                                {rateCards.map(c => (
                                    <MenuItem key={c.id} value={c.id}>
                                        {c.name} {!c.active && '(Archived)'}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Tooltip title="Create new rate card">
                            <IconButton onClick={handleOpenCreate} color="primary" sx={{ border: '1px solid', borderColor: 'divider' }}>
                                <AddIcon />
                            </IconButton>
                        </Tooltip>

                        {selectedCardId && (
                            <>
                                <Tooltip title="Rename rate card">
                                    <IconButton onClick={handleOpenRename}>
                                        <EditIcon />
                                    </IconButton>
                                </Tooltip>

                                {getSelectedCard()?.active ? (
                                    <Tooltip title="Archive rate card">
                                        <IconButton onClick={handleOpenArchive} color="warning">
                                            <ArchiveIcon />
                                        </IconButton>
                                    </Tooltip>
                                ) : (
                                    <Tooltip title="Restore rate card">
                                        <IconButton onClick={handleOpenRestore} color="success">
                                            <RestoreIcon />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </>
                        )}
                    </Box>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                size="small"
                            />
                        }
                        label={<Typography variant="caption" color="text.secondary">Show archived</Typography>}
                        sx={{ ml: 1, mt: 0.5 }}
                    />
                </Grid>

                <Grid item xs={12} md={6}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                        <FormControl fullWidth disabled={!selectedCardId || (getSelectedCard() && !getSelectedCard()?.active)}>
                            <InputLabel>Tier</InputLabel>
                            <Select
                                value={selectedTierId}
                                label="Tier"
                                onChange={(e) => {
                                    setSelectedTierId(e.target.value as number)
                                }}
                            >
                                {tiers.map(t => (
                                    <MenuItem key={t.id} value={t.id}>
                                        {t.label ? `${t.label} (Weight ≤ ${t.max_oz} oz)` : `Weight ≤ ${t.max_oz} oz`} {!t.active && '(Archived)'}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {selectedCardId && (getSelectedCard()?.active) && (
                            <Tooltip title="Add Tier">
                                <IconButton onClick={handleOpenTierCreate} color="primary" sx={{ border: '1px solid', borderColor: 'divider' }}>
                                    <AddIcon />
                                </IconButton>
                            </Tooltip>
                        )}

                        {selectedTierId && (
                            <>
                                <Tooltip title="Edit Tier">
                                    <IconButton onClick={handleOpenTierEdit} disabled={!getSelectedTier()?.active}>
                                        <EditIcon />
                                    </IconButton>
                                </Tooltip>

                                {getSelectedTier()?.active ? (
                                    <Tooltip title="Archive Tier">
                                        <IconButton onClick={handleOpenTierArchive} color="warning">
                                            <ArchiveIcon />
                                        </IconButton>
                                    </Tooltip>
                                ) : (
                                    <Tooltip title="Restore Tier">
                                        <IconButton onClick={handleOpenTierRestore} color="success">
                                            <RestoreIcon />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </>
                        )}
                    </Box>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={showArchivedTiers}
                                onChange={(e) => setShowArchivedTiers(e.target.checked)}
                                size="small"
                            />
                        }
                        label={<Typography variant="caption" color="text.secondary">Show archived tiers</Typography>}
                        sx={{ ml: 1, mt: 0.5 }}
                    />
                </Grid>
            </Grid>

            {/* Rename/Create Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
                <DialogTitle>
                    {dialogMode === 'create' && 'Create Rate Card'}
                    {dialogMode === 'rename' && 'Rename Rate Card'}
                    {dialogMode === 'archive' && 'Archive Rate Card?'}
                    {dialogMode === 'restore' && 'Restore Rate Card?'}
                </DialogTitle>
                <DialogContent>
                    {(dialogMode === 'create' || dialogMode === 'rename') && (
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Rate Card Name"
                            fullWidth
                            variant="outlined"
                            value={dialogValue}
                            onChange={(e) => setDialogValue(e.target.value)}
                        />
                    )}
                    {dialogMode === 'archive' && (
                        <Typography>
                            Are you sure you want to archive <strong>{getSelectedCard()?.name}</strong>?
                            It will be hidden from default lists but preserved in history.
                        </Typography>
                    )}
                    {dialogMode === 'restore' && (
                        <Typography>
                            Restore <strong>{getSelectedCard()?.name}</strong> to active status?
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleDialogSubmit} variant="contained" color={dialogMode === 'archive' ? 'warning' : 'primary'}>
                        {dialogMode === 'create' && 'Create'}
                        {dialogMode === 'rename' && 'Save'}
                        {dialogMode === 'archive' && 'Archive'}
                        {dialogMode === 'restore' && 'Restore'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Tier Dialog */}
            <Dialog open={tierDialogOpen} onClose={() => setTierDialogOpen(false)}>
                <DialogTitle>
                    {tierDialogMode === 'create' && 'Create Tier'}
                    {tierDialogMode === 'edit' && 'Edit Tier'}
                    {tierDialogMode === 'archive' && 'Archive Tier?'}
                    {tierDialogMode === 'restore' && 'Restore Tier?'}
                </DialogTitle>
                <DialogContent>
                    {(tierDialogMode === 'create' || tierDialogMode === 'edit') && (
                        <>
                            <TextField
                                autoFocus
                                margin="dense"
                                label="Max Weight (oz)"
                                fullWidth
                                type="number"
                                variant="outlined"
                                value={tierMaxWeight}
                                onChange={(e) => setTierMaxWeight(e.target.value)}
                            />
                            <TextField
                                margin="dense"
                                label="Label (Optional)"
                                fullWidth
                                variant="outlined"
                                value={tierLabel}
                                onChange={(e) => setTierLabel(e.target.value)}
                                helperText="e.g. '8 oz'"
                            />
                        </>
                    )}
                    {tierDialogMode === 'archive' && (
                        <Typography>
                            Are you sure you want to archive this tier?
                        </Typography>
                    )}
                    {tierDialogMode === 'restore' && (
                        <Typography>
                            Restore this tier to active status?
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTierDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleTierDialogSubmit} variant="contained" color={tierDialogMode === 'archive' ? 'warning' : 'primary'}>
                        {tierDialogMode === 'create' && 'Create'}
                        {tierDialogMode === 'edit' && 'Save'}
                        {tierDialogMode === 'archive' && 'Archive'}
                        {tierDialogMode === 'restore' && 'Restore'}
                    </Button>
                </DialogActions>
            </Dialog>

            {loading && <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />}

            {!loading && selectedTierId && (
                <Paper sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">
                            Zone Rates (Weight Not Over: {getSelectedTier()?.max_oz} oz)
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disabled={saving || (getSelectedTier() && !getSelectedTier()?.active)}
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </Box>

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Zone Name</TableCell>
                                    <TableCell>Code</TableCell>
                                    <TableCell>Rate ($)</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {zoneRates.map(row => (
                                    <TableRow key={row.zone_id}>
                                        <TableCell>{row.zone_name}</TableCell>
                                        <TableCell>{row.zone_code}</TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                type="number"
                                                placeholder="0.00"
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                                }}
                                                value={localValues[row.zone_id] !== undefined ? localValues[row.zone_id] : ''}
                                                onChange={(e) => handleLocalChange(row.zone_id, e.target.value)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            <Snackbar
                open={!!message}
                autoHideDuration={6000}
                onClose={() => setMessage(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={message?.type} onClose={() => setMessage(null)}>
                    {message?.text}
                </Alert>
            </Snackbar>
        </Box>
    )
}
