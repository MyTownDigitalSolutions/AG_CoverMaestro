import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem,
  ListItemButton, ListItemIcon, ListItemText, Divider, IconButton, Collapse
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/Dashboard'
import BusinessIcon from '@mui/icons-material/Business'
import CategoryIcon from '@mui/icons-material/Category'
import TextureIcon from '@mui/icons-material/Texture'
import BuildIcon from '@mui/icons-material/Build'
import InventoryIcon from '@mui/icons-material/Inventory'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import DesignServicesIcon from '@mui/icons-material/DesignServices'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import PeopleIcon from '@mui/icons-material/People'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import CalculateIcon from '@mui/icons-material/Calculate'
import DescriptionIcon from '@mui/icons-material/Description'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import SettingsIcon from '@mui/icons-material/Settings'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'

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

const drawerWidth = 240

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  {
    text: 'Product Catalog Creation',
    icon: <MenuBookIcon />,
    path: '/product-catalog',
    children: [
      { text: 'Manufacturers', icon: <BusinessIcon />, path: '/manufacturers' },
      { text: 'Models', icon: <CategoryIcon />, path: '/models' },
      { text: 'Equipment Types', icon: <BuildIcon />, path: '/equipment-types' },
      { text: 'Product Design Options', icon: <DesignServicesIcon />, path: '/design-options' },
    ]
  },
  {
    text: 'Pricing / Calculation Settings',
    icon: <CalculateIcon />,
    path: '/pricing-settings',
    children: [
      { text: 'Pricing Options', icon: <LocalOfferIcon />, path: '/pricing-options' },
      { text: 'Pricing Calculator', icon: <CalculateIcon />, path: '/pricing' },
      { text: 'Shipping Rates', icon: <AttachMoneyIcon />, path: '/settings/shipping-rates' },
      { text: 'Shipping Defaults', icon: <LocalShippingIcon />, path: '/settings/shipping-defaults' },
      { text: 'Labor / Fees / Profit', icon: <SettingsIcon />, path: '/settings?tab=general' },
    ]
  },
  {
    text: 'Suppliers / Materials',
    icon: <InventoryIcon />,
    path: '/suppliers-materials',
    children: [
      { text: 'Materials', icon: <TextureIcon />, path: '/materials' },
      { text: 'Suppliers', icon: <LocalShippingIcon />, path: '/suppliers' },
    ]
  },
  { text: 'Customers', icon: <PeopleIcon />, path: '/customers' },
  { text: 'Orders', icon: <ShoppingCartIcon />, path: '/orders' },
  {
    text: 'Templates',
    icon: <DescriptionIcon />,
    path: '/templates/amazon', // Default to Amazon
    children: [
      { text: 'Amazon', icon: <DescriptionIcon />, path: '/templates/amazon' },
      { text: 'eBay', icon: <DescriptionIcon />, path: '/templates/ebay' },
      { text: 'Reverb', icon: <DescriptionIcon />, path: '/templates/reverb' },
      { text: 'Etsy', icon: <DescriptionIcon />, path: '/templates/etsy' },
    ]
  },
  { text: 'Export', icon: <FileDownloadIcon />, path: '/export' },
]

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const newOpen: Record<string, boolean> = {}

    // Check Product Catalog
    if (['/product-catalog', '/manufacturers', '/models', '/equipment-types', '/design-options'].some(p => location.pathname.startsWith(p))) {
      newOpen['Product Catalog Creation'] = true
    }

    // Check Pricing Settings
    if (['/pricing', '/settings', '/pricing-settings'].some(p => location.pathname.startsWith(p))) {
      newOpen['Pricing / Calculation Settings'] = true
    }

    // Check Suppliers / Materials
    if (['/materials', '/suppliers', '/suppliers-materials'].some(p => location.pathname.startsWith(p))) {
      newOpen['Suppliers / Materials'] = true
    }

    // Check Templates
    if (location.pathname.startsWith('/templates')) {
      newOpen['Templates'] = true
    }

    if (Object.keys(newOpen).length > 0) {
      setOpenSections(prev => ({ ...prev, ...newOpen }))
    }
  }, [location.pathname])

  const handleExpandClick = (e: React.MouseEvent, text: string) => {
    e.stopPropagation()
    setOpenSections(prev => ({ ...prev, [text]: !prev[text] }))
  }

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap>
          Cover Maker
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item: any) => (
          item.children ? (
            <div key={item.text}>
              <ListItem disablePadding>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                  <IconButton onClick={(e) => handleExpandClick(e, item.text)} edge="end" size="small">
                    {openSections[item.text] ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </ListItemButton>
              </ListItem>
              <Collapse in={!!openSections[item.text]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {item.children.map((child: any) => (
                    <ListItemButton
                      key={child.text}
                      sx={{ pl: 4 }}
                      selected={location.pathname === child.path}
                      onClick={() => navigate(child.path)}
                    >
                      <ListItemIcon>{child.icon}</ListItemIcon>
                      <ListItemText primary={child.text} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </div>
          ) : (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          )
        ))}
      </List>
    </div>
  )


  return (
    <Box sx={{ display: 'flex', width: '100%' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Cover Making Application
          </Typography>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawer}
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
