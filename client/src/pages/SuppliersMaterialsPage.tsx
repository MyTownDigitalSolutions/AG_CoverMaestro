import { useNavigate } from 'react-router-dom'
import { Box, Typography, Grid, Paper } from '@mui/material'
import TextureIcon from '@mui/icons-material/Texture'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import LinkIcon from '@mui/icons-material/Link'

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

export default function SuppliersMaterialsPage() {
    const navigate = useNavigate()

    const actions = [
        { text: 'Materials', icon: <TextureIcon />, path: '/materials', description: 'Manage raw materials inventory' },
        { text: 'Suppliers', icon: <LocalShippingIcon />, path: '/suppliers', description: 'Manage supplier contacts' },
        { text: 'Material Role Assignments', icon: <LinkIcon />, path: '/materials#material-roles', description: 'Assign roles like "Choice - Padded" to specific materials' },
    ]

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Suppliers / Materials
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4 }}>
                Central hub for managing inventory, supplier relationships, and material assignments.
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
