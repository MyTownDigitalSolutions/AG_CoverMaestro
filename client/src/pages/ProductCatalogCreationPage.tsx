import { useNavigate } from 'react-router-dom'
import { Box, Typography, Grid, Paper } from '@mui/material'
import BusinessIcon from '@mui/icons-material/Business'
import CategoryIcon from '@mui/icons-material/Category'
import BuildIcon from '@mui/icons-material/Build'
import DesignServicesIcon from '@mui/icons-material/DesignServices'

export default function ProductCatalogCreationPage() {
    const navigate = useNavigate()

    const actions = [
        { text: 'Manufacturers', icon: <BusinessIcon />, path: '/manufacturers', description: 'Manage brands and makers' },
        { text: 'Models', icon: <CategoryIcon />, path: '/models', description: 'Configure product models' },
        { text: 'Equipment Types', icon: <BuildIcon />, path: '/equipment-types', description: 'Define categories of equipment' },
        { text: 'Product Design Options', icon: <DesignServicesIcon />, path: '/design-options', description: 'Customize design choices' },
    ]

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Product Catalog Creation
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4 }}>
                Central hub for managing all aspects of the product catalog.
            </Typography>

            <Grid container spacing={3}>
                {actions.map((action) => (
                    <Grid item xs={12} sm={6} md={3} key={action.text}>
                        <Paper
                            sx={{
                                p: 4,
                                height: '100%',
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
                                {/* Scale icon with sx fontSize or transform */}
                                {/* Render icon with large fontSize */}
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
