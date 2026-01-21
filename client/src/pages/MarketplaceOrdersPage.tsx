import { useState } from 'react'
import {
    Box, Typography, Container, TextField, Button, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, MenuItem, Alert, CircularProgress, Dialog,
    DialogTitle, DialogContent, DialogActions, Divider, Chip
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ListAltIcon from '@mui/icons-material/ListAlt'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'

interface MarketplaceOrder {
    id: number
    marketplace: string
    source: string
    external_order_id: string
    external_order_number?: string
    order_date: string
    status_raw?: string
    status_normalized?: string
    buyer_name?: string
    buyer_email?: string
    order_total_cents?: number
    currency_code?: string
    created_at: string
}

interface OrderAddress {
    id: number
    address_type: string
    name?: string
    line1?: string
    line2?: string
    city?: string
    state_or_region?: string
    postal_code?: string
    country_code?: string
    phone?: string
}

interface OrderLine {
    id: number
    external_line_item_id?: string
    sku?: string
    title?: string
    quantity: number
    unit_price_cents?: number
    line_total_cents?: number
}

interface OrderShipment {
    id: number
    carrier?: string
    tracking_number?: string
    shipped_at?: string
}

interface CleanupResult {
    dry_run: boolean
    marketplace: string
    order_id: number | null
    mode: string
    rows_scanned: number
    duplicate_groups_found: number
    rows_to_delete: number
    rows_deleted: number
    affected_order_ids_sample: number[]
}

interface OrderDetail extends MarketplaceOrder {
    addresses: OrderAddress[]
    lines: OrderLine[]
    shipments: OrderShipment[]
}

export default function MarketplaceOrdersPage() {
    // Filter state
    const [marketplace, setMarketplace] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [buyerEmail, setBuyerEmail] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [limit, setLimit] = useState(50)

    // Results state
    const [orders, setOrders] = useState<MarketplaceOrder[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Detail dialog state
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
    const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null)
    const [isLoadingDetail, setIsLoadingDetail] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)

    // Admin key state
    const [adminKey, setAdminKey] = useState('')

    // Cleanup state
    const [cleanupLoadingPreview, setCleanupLoadingPreview] = useState(false)
    const [cleanupLoadingRun, setCleanupLoadingRun] = useState(false)
    const [cleanupPreviewResult, setCleanupPreviewResult] = useState<CleanupResult | null>(null)
    const [cleanupRunResult, setCleanupRunResult] = useState<CleanupResult | null>(null)
    const [cleanupError, setCleanupError] = useState<string | null>(null)
    const [cleanupPreviewOrderId, setCleanupPreviewOrderId] = useState<number | null>(null)

    const handleSearch = async () => {
        setIsSearching(true)
        setError(null)
        setOrders([])

        try {
            const params = new URLSearchParams()
            if (marketplace !== 'all') params.append('marketplace', marketplace)
            if (statusFilter !== 'all') params.append('status_normalized', statusFilter)
            if (buyerEmail.trim()) params.append('buyer_email', buyerEmail.trim())
            if (dateFrom) params.append('date_from', dateFrom)
            if (dateTo) params.append('date_to', dateTo)
            params.append('limit', limit.toString())

            const response = await fetch(`/api/marketplace-orders?${params.toString()}`)

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Error ${response.status}: ${text.slice(0, 100)}`)
            }

            const data: MarketplaceOrder[] = await response.json()
            setOrders(data)

            if (data.length === 0) {
                setError('No orders found matching the criteria.')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error occurred')
        } finally {
            setIsSearching(false)
        }
    }

    const handleRowClick = async (orderId: number) => {
        setSelectedOrderId(orderId)
        setIsLoadingDetail(true)
        setDetailError(null)
        setOrderDetail(null)

        try {
            const response = await fetch(`/api/marketplace-orders/${orderId}`)

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Error ${response.status}: ${text.slice(0, 100)}`)
            }

            const data: OrderDetail = await response.json()
            setOrderDetail(data)
        } catch (err) {
            setDetailError(err instanceof Error ? err.message : 'Failed to load order details')
        } finally {
            setIsLoadingDetail(false)
        }
    }

    const handleCloseDetail = () => {
        setSelectedOrderId(null)
        setOrderDetail(null)
        setDetailError(null)
        // Reset cleanup state when closing
        setCleanupPreviewResult(null)
        setCleanupRunResult(null)
        setCleanupError(null)
        setCleanupPreviewOrderId(null)
    }

    const handleCleanupShipmentsPreview = async () => {
        if (!orderDetail || !adminKey.trim()) {
            setCleanupError('Admin key is required for cleanup operations.')
            return
        }

        setCleanupLoadingPreview(true)
        setCleanupError(null)
        setCleanupPreviewResult(null)
        setCleanupRunResult(null)

        try {
            const response = await fetch('/api/marketplace-orders/cleanup-shipments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Key': adminKey.trim()
                },
                body: JSON.stringify({
                    marketplace: orderDetail.marketplace,
                    order_id: orderDetail.id,
                    mode: 'prefer_tracked',
                    dry_run: true
                })
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Error ${response.status}: ${text.slice(0, 150)}`)
            }

            const data: CleanupResult = await response.json()
            setCleanupPreviewResult(data)
            setCleanupPreviewOrderId(orderDetail.id)
        } catch (err) {
            setCleanupError(err instanceof Error ? err.message : 'Cleanup preview failed')
        } finally {
            setCleanupLoadingPreview(false)
        }
    }

    const handleCleanupShipmentsRun = async () => {
        if (!orderDetail || !adminKey.trim()) {
            setCleanupError('Admin key is required for cleanup operations.')
            return
        }

        setCleanupLoadingRun(true)
        setCleanupError(null)
        setCleanupRunResult(null)

        try {
            const response = await fetch('/api/marketplace-orders/cleanup-shipments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Key': adminKey.trim()
                },
                body: JSON.stringify({
                    marketplace: orderDetail.marketplace,
                    order_id: orderDetail.id,
                    mode: 'prefer_tracked',
                    dry_run: false
                })
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Error ${response.status}: ${text.slice(0, 150)}`)
            }

            const data: CleanupResult = await response.json()
            setCleanupRunResult(data)

            // Re-fetch order detail to update shipments list
            const detailResponse = await fetch(`/api/marketplace-orders/${orderDetail.id}`)
            if (detailResponse.ok) {
                const detailData: OrderDetail = await detailResponse.json()
                setOrderDetail(detailData)
            }
        } catch (err) {
            setCleanupError(err instanceof Error ? err.message : 'Cleanup run failed')
        } finally {
            setCleanupLoadingRun(false)
        }
    }

    // Check if cleanup confirm button should be enabled
    const canRunCleanup = cleanupPreviewResult !== null &&
        cleanupPreviewOrderId === orderDetail?.id &&
        cleanupPreviewResult.rows_to_delete > 0 &&
        !cleanupLoadingRun

    const formatCurrency = (cents?: number, currency?: string) => {
        if (cents === null || cents === undefined) return '—'
        const dollars = cents / 100
        return `${currency || 'USD'} ${dollars.toFixed(2)}`
    }

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleString()
        } catch {
            return dateStr
        }
    }

    return (
        <Container maxWidth="xl">
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <ListAltIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Typography variant="h4" component="h1">
                        Marketplace Orders
                    </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary">
                    View and search orders imported from connected marketplaces.
                </Typography>
            </Box>

            {/* Admin Key Input */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TextField
                        label="Admin Key"
                        type="password"
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        size="small"
                        sx={{ width: 300 }}
                        placeholder="Required for cleanup operations"
                    />
                    <Typography variant="body2" color="text.secondary">
                        Admin key is required for shipment cleanup operations in order detail.
                    </Typography>
                </Box>
            </Paper>

            {/* Filters */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Filters
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                    <TextField
                        select
                        label="Marketplace"
                        value={marketplace}
                        onChange={(e) => setMarketplace(e.target.value)}
                        size="small"
                        sx={{ width: 150 }}
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="reverb">Reverb</MenuItem>
                        <MenuItem value="amazon">Amazon</MenuItem>
                        <MenuItem value="ebay">eBay</MenuItem>
                        <MenuItem value="etsy">Etsy</MenuItem>
                    </TextField>

                    <TextField
                        select
                        label="Status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        size="small"
                        sx={{ width: 150 }}
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="pending">Pending</MenuItem>
                        <MenuItem value="processing">Processing</MenuItem>
                        <MenuItem value="shipped">Shipped</MenuItem>
                        <MenuItem value="delivered">Delivered</MenuItem>
                        <MenuItem value="cancelled">Cancelled</MenuItem>
                        <MenuItem value="unknown">Unknown</MenuItem>
                    </TextField>

                    <TextField
                        label="Buyer Email"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        size="small"
                        sx={{ width: 250 }}
                        placeholder="Search by email"
                    />

                    <TextField
                        label="Date From"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 180 }}
                    />

                    <TextField
                        label="Date To"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        size="small"
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 180 }}
                    />

                    <TextField
                        label="Limit"
                        type="number"
                        value={limit}
                        onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
                        size="small"
                        sx={{ width: 100 }}
                        inputProps={{ min: 1, max: 500 }}
                    />
                </Box>

                <Button
                    variant="contained"
                    startIcon={isSearching ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                    onClick={handleSearch}
                    disabled={isSearching}
                >
                    Search
                </Button>
            </Paper>

            {/* Error display */}
            {error && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Results table */}
            {orders.length > 0 && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Order Date</TableCell>
                                <TableCell>Marketplace</TableCell>
                                <TableCell>Order ID</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Buyer Email</TableCell>
                                <TableCell align="right">Total</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow
                                    key={order.id}
                                    hover
                                    onClick={() => handleRowClick(order.id)}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell>{formatDate(order.order_date)}</TableCell>
                                    <TableCell>
                                        <Chip label={order.marketplace} size="small" color="primary" variant="outlined" />
                                    </TableCell>
                                    <TableCell>{order.external_order_number || order.external_order_id}</TableCell>
                                    <TableCell>
                                        {order.status_normalized || order.status_raw || '—'}
                                    </TableCell>
                                    <TableCell>{order.buyer_email || '—'}</TableCell>
                                    <TableCell align="right">
                                        {formatCurrency(order.order_total_cents, order.currency_code)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Order Detail Dialog */}
            <Dialog
                open={selectedOrderId !== null}
                onClose={handleCloseDetail}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    Order Details
                    {orderDetail && (
                        <Typography variant="body2" color="text.secondary">
                            {orderDetail.marketplace} - {orderDetail.external_order_number || orderDetail.external_order_id}
                        </Typography>
                    )}
                </DialogTitle>
                <DialogContent>
                    {isLoadingDetail && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {detailError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {detailError}
                        </Alert>
                    )}

                    {orderDetail && !isLoadingDetail && (
                        <Box>
                            {/* Order Info */}
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                Order Information
                            </Typography>
                            <Box sx={{ mb: 3, pl: 2 }}>
                                <Typography variant="body2"><strong>Buyer:</strong> {orderDetail.buyer_name || '—'}</Typography>
                                <Typography variant="body2"><strong>Email:</strong> {orderDetail.buyer_email || '—'}</Typography>
                                <Typography variant="body2"><strong>Order Date:</strong> {formatDate(orderDetail.order_date)}</Typography>
                                <Typography variant="body2"><strong>Status:</strong> {orderDetail.status_normalized || orderDetail.status_raw || '—'}</Typography>
                                <Typography variant="body2"><strong>Total:</strong> {formatCurrency(orderDetail.order_total_cents, orderDetail.currency_code)}</Typography>
                            </Box>

                            <Divider sx={{ my: 2 }} />

                            {/* Addresses */}
                            {orderDetail.addresses && orderDetail.addresses.length > 0 && (
                                <>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                        Addresses
                                    </Typography>
                                    {orderDetail.addresses.map((addr, idx) => (
                                        <Box key={addr.id} sx={{ mb: 2, pl: 2 }}>
                                            <Typography variant="body2" color="primary">
                                                <strong>{addr.address_type.toUpperCase()}</strong>
                                            </Typography>
                                            <Typography variant="body2">{addr.name}</Typography>
                                            <Typography variant="body2">{addr.line1}</Typography>
                                            {addr.line2 && <Typography variant="body2">{addr.line2}</Typography>}
                                            <Typography variant="body2">
                                                {addr.city}, {addr.state_or_region} {addr.postal_code}
                                            </Typography>
                                            <Typography variant="body2">{addr.country_code}</Typography>
                                            {addr.phone && <Typography variant="body2">Phone: {addr.phone}</Typography>}
                                        </Box>
                                    ))}
                                    <Divider sx={{ my: 2 }} />
                                </>
                            )}

                            {/* Order Lines */}
                            {orderDetail.lines && orderDetail.lines.length > 0 && (
                                <>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                        Line Items
                                    </Typography>
                                    <TableContainer>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>SKU</TableCell>
                                                    <TableCell>Title</TableCell>
                                                    <TableCell align="right">Qty</TableCell>
                                                    <TableCell align="right">Unit Price</TableCell>
                                                    <TableCell align="right">Total</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {orderDetail.lines.map((line) => (
                                                    <TableRow key={line.id}>
                                                        <TableCell>{line.sku || '—'}</TableCell>
                                                        <TableCell>{line.title || '—'}</TableCell>
                                                        <TableCell align="right">{line.quantity}</TableCell>
                                                        <TableCell align="right">
                                                            {formatCurrency(line.unit_price_cents, orderDetail.currency_code)}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {formatCurrency(line.line_total_cents, orderDetail.currency_code)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                    <Divider sx={{ my: 2 }} />
                                </>
                            )}

                            {/* Shipments */}
                            {orderDetail.shipments && orderDetail.shipments.length > 0 && (
                                <>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                        Shipments
                                    </Typography>
                                    {orderDetail.shipments.map((shipment) => (
                                        <Box key={shipment.id} sx={{ mb: 1, pl: 2 }}>
                                            <Typography variant="body2">
                                                <strong>Carrier:</strong> {shipment.carrier || '—'}
                                            </Typography>
                                            <Typography variant="body2">
                                                <strong>Tracking:</strong> {shipment.tracking_number || '—'}
                                            </Typography>
                                            {shipment.shipped_at && (
                                                <Typography variant="body2">
                                                    <strong>Shipped:</strong> {formatDate(shipment.shipped_at)}
                                                </Typography>
                                            )}
                                        </Box>
                                    ))}
                                </>
                            )}

                            <Divider sx={{ my: 2 }} />

                            {/* Shipment Cleanup Section */}
                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CleaningServicesIcon fontSize="small" />
                                Shipment Cleanup (Prefer Tracked)
                            </Typography>
                            <Box sx={{ pl: 2 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                    Remove duplicate shipment rows that have no tracking number when a tracked shipment exists for the same carrier.
                                </Typography>

                                {!adminKey.trim() && (
                                    <Alert severity="info" sx={{ mb: 2 }}>
                                        Enter an Admin Key at the top of the page to enable cleanup operations.
                                    </Alert>
                                )}

                                {cleanupError && (
                                    <Alert severity="error" sx={{ mb: 2 }}>
                                        {cleanupError}
                                    </Alert>
                                )}

                                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                                    <Button
                                        variant="outlined"
                                        onClick={handleCleanupShipmentsPreview}
                                        disabled={!adminKey.trim() || cleanupLoadingPreview || cleanupLoadingRun}
                                        startIcon={cleanupLoadingPreview ? <CircularProgress size={16} /> : undefined}
                                    >
                                        Preview Cleanup
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="warning"
                                        onClick={handleCleanupShipmentsRun}
                                        disabled={!canRunCleanup}
                                        startIcon={cleanupLoadingRun ? <CircularProgress size={16} color="inherit" /> : undefined}
                                    >
                                        Run Cleanup
                                    </Button>
                                </Box>

                                {/* Preview Results */}
                                {cleanupPreviewResult && cleanupPreviewOrderId === orderDetail.id && (
                                    <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                                        <Typography variant="body2" fontWeight="bold" gutterBottom>
                                            Preview Results (Dry Run)
                                        </Typography>
                                        <Typography variant="body2">Rows Scanned: {cleanupPreviewResult.rows_scanned}</Typography>
                                        <Typography variant="body2">Duplicate Groups Found: {cleanupPreviewResult.duplicate_groups_found}</Typography>
                                        <Typography variant="body2" color={cleanupPreviewResult.rows_to_delete > 0 ? 'warning.main' : 'text.secondary'}>
                                            Rows to Delete: {cleanupPreviewResult.rows_to_delete}
                                        </Typography>
                                        {cleanupPreviewResult.rows_to_delete === 0 && (
                                            <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                                                ✓ Nothing to delete. All shipments are clean.
                                            </Typography>
                                        )}
                                    </Paper>
                                )}

                                {/* Run Results */}
                                {cleanupRunResult && (
                                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50', borderColor: 'success.main' }}>
                                        <Typography variant="body2" fontWeight="bold" gutterBottom color="success.main">
                                            Cleanup Complete
                                        </Typography>
                                        <Typography variant="body2">Rows Deleted: {cleanupRunResult.rows_deleted}</Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                            Shipments list has been refreshed.
                                        </Typography>
                                    </Paper>
                                )}
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDetail}>Close</Button>
                </DialogActions>
            </Dialog>
        </Container>
    )
}
