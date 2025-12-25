import { useNavigate } from 'react-router-dom'
import { Box, Typography, Grid, Paper } from '@mui/material'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import CalculateIcon from '@mui/icons-material/Calculate'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import SettingsIcon from '@mui/icons-material/Settings'

/*
 * UI WORK LOG - 2025-12-24
 * -------------------------
 * - Implemented Sidebar Navigation Restructuring:
 *   - Created "Pricing / Calculation Settings" collapsible group.
 *   - Created "Suppliers / Materials" collapsible group.
 *   - Removed root-level items for cleanup.
 * - Implemented Hub Pages:
 *   - Created PricingCalculationSettingsPage (Hub for Pricing).
 *   - Created SuppliersMaterialsPage (Hub for Suppliers/Materials).
 * - Implemented Deep Linking:
 *   - Added "Material Role Assignments" section to Materials Page (embedding existing Settings UI).
 *   - Added deep-link anchor (#material-roles) with auto-scroll.
 *   - Updated Hub Page to link directly to this anchor.
 *
 * This comment serves as the authoritative record of changes due to task numbering drift.
 */

export default function PricingCalculationSettingsPage() {
    const navigate = useNavigate()

    const actions = [
        { text: 'Pricing Options', icon: <LocalOfferIcon />, path: '/pricing-options', description: 'Configure base pricing parameters' },
        { text: 'Pricing Calculator', icon: <CalculateIcon />, path: '/pricing', description: 'Calculate and preview product pricing' },
        { text: 'Shipping Rates', icon: <AttachMoneyIcon />, path: '/settings/shipping-rates', description: 'Manage shipping rate cards and zones' },
        { text: 'Shipping Defaults', icon: <LocalShippingIcon />, path: '/settings/shipping-defaults', description: 'Set default shipping configuration' },
        { text: 'Labor / Fees / Profit', icon: <SettingsIcon />, path: '/settings?tab=general', description: 'Configure global labor rates, fees, and margins' },
    ]

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Pricing / Calculation Settings
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4 }}>
                Central hub for managing pricing logic, shipping configurations, and profitability settings.
            </Typography>

            <Grid container spacing={3}>
                {actions.map((action) => (
                    <Grid item xs={12} sm={6} md={4} key={action.text}>
                        <Paper
                            sx={{
                                p: 4,
                                height: '220px', // Fixed height for uniformity
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                '&:hover': {
                                    bgcolor: 'action.hover',
                                    transform: 'translateY(-4px)',
                                    boxShadow: 4
                                },
                                transition: 'all 0.3s ease'
                            }}
                            onClick={() => navigate(action.path)}
                            elevation={2}
                        >
                            <Box sx={{ color: 'primary.main', mb: 2 }}>
                                <action.icon.type {...action.icon.props} sx={{ fontSize: 40 }} />
                            </Box>
                            <Typography variant="h6" align="center" gutterBottom>
                                {action.text}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" align="center">
                                {action.description}
                            </Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Box>
    )
}
