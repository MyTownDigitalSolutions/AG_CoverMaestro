import { useState } from 'react'
import {
    Box, Typography, Paper, Container, TextField, Button, Switch,
    FormControlLabel, Alert, CircularProgress, IconButton, InputAdornment,
    Divider, Card, CardContent, CardHeader, Chip
} from '@mui/material'
import StorefrontIcon from '@mui/icons-material/Storefront'
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'

// Masked token placeholder returned by backend when reveal is disabled
const MASKED_TOKEN = '********'

interface ReverbCredentials {
    marketplace: string
    is_enabled: boolean
    api_token: string
    base_url: string
    updated_at: string
}

interface TestResult {
    ok: boolean
    marketplace: string
    status_code: number
    account?: {
        shop_name?: string
        username?: string
        email?: string
        locale?: string
    }
    error?: string
}

type StatusType = 'idle' | 'loading' | 'success' | 'error' | 'not_configured'

interface Status {
    type: StatusType
    message: string
}

/**
 * MarketplaceCredentialsPage - Manage API credentials for connected marketplaces
 */
export default function MarketplaceCredentialsPage() {
    // Admin key (required for all API calls)
    const [adminKey, setAdminKey] = useState('')

    // Reverb form state
    const [isEnabled, setIsEnabled] = useState(true)
    const [baseUrl, setBaseUrl] = useState('https://api.reverb.com')
    const [apiToken, setApiToken] = useState('')
    const [showToken, setShowToken] = useState(false)

    // Track if token was loaded from server (for masked token handling)
    const [loadedToken, setLoadedToken] = useState('')

    // Status indicators
    const [refreshStatus, setRefreshStatus] = useState<Status>({ type: 'idle', message: '' })
    const [saveStatus, setSaveStatus] = useState<Status>({ type: 'idle', message: '' })
    const [testStatus, setTestStatus] = useState<Status>({ type: 'idle', message: '' })
    const [testResult, setTestResult] = useState<TestResult | null>(null)

    // Loading states
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isTesting, setIsTesting] = useState(false)

    const hasAdminKey = adminKey.trim().length > 0

    // Helper to make authenticated requests
    const authFetch = async (url: string, options: RequestInit = {}) => {
        const headers = {
            ...options.headers,
            'X-Admin-Key': adminKey,
        } as Record<string, string>

        if (options.method === 'PUT' || options.method === 'POST') {
            headers['Content-Type'] = 'application/json'
        }

        return fetch(url, { ...options, headers })
    }

    // Refresh credentials from server
    const handleRefresh = async () => {
        if (!hasAdminKey) return

        setIsRefreshing(true)
        setRefreshStatus({ type: 'loading', message: 'Loading credentials...' })
        setTestResult(null)

        try {
            const response = await authFetch('/api/marketplace-credentials/reverb')

            if (response.status === 404) {
                setRefreshStatus({ type: 'not_configured', message: 'Not configured yet. Save credentials to configure.' })
                setIsEnabled(true)
                setBaseUrl('https://api.reverb.com')
                setApiToken('')
                setLoadedToken('')
                return
            }

            if (response.status === 401) {
                setRefreshStatus({ type: 'error', message: 'Invalid Admin Key' })
                return
            }

            if (!response.ok) {
                const text = await response.text()
                setRefreshStatus({ type: 'error', message: `Error ${response.status}: ${text.slice(0, 100)}` })
                return
            }

            const data: ReverbCredentials = await response.json()
            setIsEnabled(data.is_enabled)
            setBaseUrl(data.base_url || 'https://api.reverb.com')
            setApiToken(data.api_token)
            setLoadedToken(data.api_token)
            setRefreshStatus({ type: 'success', message: `Loaded. Last updated: ${new Date(data.updated_at).toLocaleString()}` })
        } catch (err) {
            setRefreshStatus({ type: 'error', message: `Connection error: ${err instanceof Error ? err.message : 'Unknown'}` })
        } finally {
            setIsRefreshing(false)
        }
    }

    // Save credentials to server
    const handleSave = async () => {
        if (!hasAdminKey) return

        setIsSaving(true)
        setSaveStatus({ type: 'loading', message: 'Saving...' })

        try {
            // Determine if we should send the token
            // If token equals the masked placeholder and hasn't been edited, don't send it
            const tokenToSend = apiToken === MASKED_TOKEN && apiToken === loadedToken
                ? null  // Don't overwrite with masked token
                : apiToken

            // Build request body
            const body: Record<string, unknown> = {
                is_enabled: isEnabled,
                base_url: baseUrl,
            }

            // Only include api_token if we have a real value
            if (tokenToSend !== null) {
                body.api_token = tokenToSend
            }

            // If no token provided and this is first save, require it
            if (!tokenToSend && loadedToken === '') {
                setSaveStatus({ type: 'error', message: 'API Token is required for initial setup' })
                return
            }

            // For update with masked token unchanged, still need to send api_token (backend requires it)
            // The backend schema requires api_token, so we must send the masked value if unchanged
            if (tokenToSend === null) {
                body.api_token = apiToken
            }

            const response = await authFetch('/api/marketplace-credentials/reverb', {
                method: 'PUT',
                body: JSON.stringify(body),
            })

            if (response.status === 401) {
                setSaveStatus({ type: 'error', message: 'Invalid Admin Key' })
                return
            }

            if (!response.ok) {
                const text = await response.text()
                setSaveStatus({ type: 'error', message: `Error ${response.status}: ${text.slice(0, 100)}` })
                return
            }

            const data: ReverbCredentials = await response.json()
            setLoadedToken(data.api_token)
            setApiToken(data.api_token)
            setSaveStatus({ type: 'success', message: 'Saved successfully!' })
        } catch (err) {
            setSaveStatus({ type: 'error', message: `Connection error: ${err instanceof Error ? err.message : 'Unknown'}` })
        } finally {
            setIsSaving(false)
        }
    }

    // Test credentials against Reverb API
    const handleTest = async () => {
        if (!hasAdminKey) return

        setIsTesting(true)
        setTestStatus({ type: 'loading', message: 'Testing connection...' })
        setTestResult(null)

        try {
            const response = await authFetch('/api/marketplace-credentials/reverb/test', {
                method: 'POST',
            })

            if (response.status === 401) {
                setTestStatus({ type: 'error', message: 'Invalid Admin Key' })
                return
            }

            if (!response.ok) {
                const text = await response.text()
                setTestStatus({ type: 'error', message: `Error ${response.status}: ${text.slice(0, 100)}` })
                return
            }

            const data: TestResult = await response.json()
            setTestResult(data)

            if (data.ok) {
                setTestStatus({ type: 'success', message: 'Connection successful!' })
            } else {
                setTestStatus({ type: 'error', message: data.error || `HTTP ${data.status_code}` })
            }
        } catch (err) {
            setTestStatus({ type: 'error', message: `Connection error: ${err instanceof Error ? err.message : 'Unknown'}` })
        } finally {
            setIsTesting(false)
        }
    }

    // Render status alert
    const renderStatus = (status: Status, loading: boolean) => {
        if (loading) {
            return (
                <Alert severity="info" icon={<CircularProgress size={20} />}>
                    {status.message}
                </Alert>
            )
        }

        if (status.type === 'idle') return null

        const severityMap: Record<StatusType, 'success' | 'error' | 'warning' | 'info'> = {
            idle: 'info',
            loading: 'info',
            success: 'success',
            error: 'error',
            not_configured: 'warning',
        }

        return (
            <Alert severity={severityMap[status.type]} sx={{ mt: 2 }}>
                {status.message}
            </Alert>
        )
    }

    return (
        <Container maxWidth="lg">
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <StorefrontIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Typography variant="h4" component="h1">
                        Marketplace Credentials
                    </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary">
                    Manage API credentials for connected marketplaces.
                </Typography>
            </Box>

            {/* Admin Key Section */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                    Authentication
                </Typography>
                <TextField
                    label="Admin Key"
                    type="password"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    fullWidth
                    size="small"
                    helperText={hasAdminKey ? "Admin key set" : "Enter Admin Key to access credentials"}
                    sx={{ maxWidth: 400 }}
                />
                {!hasAdminKey && (
                    <Alert severity="info" sx={{ mt: 2 }}>
                        Enter your Admin Key and click <strong>Refresh</strong> to load existing credentials.
                    </Alert>
                )}
            </Paper>

            {/* Reverb Credentials Card */}
            <Card sx={{ mb: 3 }}>
                <CardHeader
                    title={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6">Reverb</Typography>
                            {isEnabled ? (
                                <Chip label="Enabled" color="success" size="small" />
                            ) : (
                                <Chip label="Disabled" color="default" size="small" />
                            )}
                        </Box>
                    }
                    action={
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                                onClick={handleRefresh}
                                disabled={!hasAdminKey || isRefreshing}
                            >
                                Refresh
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                                onClick={handleSave}
                                disabled={!hasAdminKey || isSaving}
                            >
                                Save
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                color="secondary"
                                startIcon={isTesting ? <CircularProgress size={16} /> : <PlayArrowIcon />}
                                onClick={handleTest}
                                disabled={!hasAdminKey || isTesting}
                            >
                                Test Connection
                            </Button>
                        </Box>
                    }
                />
                <Divider />
                <CardContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Enabled toggle */}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={isEnabled}
                                    onChange={(e) => setIsEnabled(e.target.checked)}
                                />
                            }
                            label="Enabled"
                        />

                        {/* Base URL */}
                        <TextField
                            label="Base URL"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            fullWidth
                            size="small"
                            helperText="Reverb API base URL (default: https://api.reverb.com)"
                            sx={{ maxWidth: 500 }}
                        />

                        {/* API Token */}
                        <TextField
                            label="API Token"
                            type={showToken ? 'text' : 'password'}
                            value={apiToken}
                            onChange={(e) => setApiToken(e.target.value)}
                            fullWidth
                            size="small"
                            sx={{ maxWidth: 500 }}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowToken(!showToken)}
                                            edge="end"
                                            size="small"
                                        >
                                            {showToken ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            helperText={
                                apiToken === MASKED_TOKEN
                                    ? "Token is masked. Enter a new token to update, or leave as-is to keep the existing one."
                                    : "Your Reverb API personal access token"
                            }
                        />

                        {/* Status displays */}
                        {renderStatus(refreshStatus, isRefreshing)}
                        {renderStatus(saveStatus, isSaving)}
                        {renderStatus(testStatus, isTesting)}

                        {/* Test result details */}
                        {testResult && testResult.ok && testResult.account && (
                            <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'success.light', color: 'success.contrastText' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <CheckCircleIcon color="inherit" />
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        Connection Verified
                                    </Typography>
                                </Box>
                                <Box sx={{ pl: 4 }}>
                                    {testResult.account.shop_name && (
                                        <Typography variant="body2">
                                            <strong>Shop:</strong> {testResult.account.shop_name}
                                        </Typography>
                                    )}
                                    {testResult.account.username && (
                                        <Typography variant="body2">
                                            <strong>Username:</strong> {testResult.account.username}
                                        </Typography>
                                    )}
                                    {testResult.account.email && (
                                        <Typography variant="body2">
                                            <strong>Email:</strong> {testResult.account.email}
                                        </Typography>
                                    )}
                                </Box>
                            </Paper>
                        )}

                        {testResult && !testResult.ok && (
                            <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'error.light', color: 'error.contrastText' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ErrorIcon color="inherit" />
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        Connection Failed
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ pl: 4 }}>
                                    {testResult.error || `HTTP ${testResult.status_code}`}
                                </Typography>
                            </Paper>
                        )}
                    </Box>
                </CardContent>
            </Card>

            {/* Placeholder for future marketplaces */}
            <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.100' }}>
                <Typography variant="body2" color="text.secondary">
                    Additional marketplaces (Amazon, eBay, Etsy) coming soon.
                </Typography>
            </Paper>
        </Container>
    )
}
