import { Box, Typography, Paper, Container } from '@mui/material'
import StorefrontIcon from '@mui/icons-material/Storefront'

/**
 * MarketplaceCredentialsPage - Placeholder page for managing API credentials
 * 
 * This page will eventually allow users to configure and test API credentials
 * for connected marketplaces (Reverb, Amazon, eBay, Etsy).
 */
export default function MarketplaceCredentialsPage() {
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

            <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                    Coming Soon
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    This page will allow you to configure API credentials for Reverb, Amazon, eBay, and Etsy.
                </Typography>
            </Paper>
        </Container>
    )
}
