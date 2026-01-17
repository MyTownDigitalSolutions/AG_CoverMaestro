import { useEffect, useState } from 'react'
import {
    Box, Typography, Paper, Button, FormControl, InputLabel, Select, MenuItem, TextField,
    Checkbox, FormControlLabel, Alert, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow
} from '@mui/material'
import axios from 'axios'

interface MaterialRoleAssignment {
    id: number
    role: string
    material_id: number
    effective_date: string | null
    end_date: string | null
    created_at: string
}

interface MaterialRoleConfig {
    id: number
    role: string
    display_name: string | null
}

interface Material {
    id: number
    name: string
}

export default function MaterialRoleAssignmentsPage() {
    const [activeAssignments, setActiveAssignments] = useState<MaterialRoleAssignment[]>([])
    const [allAssignments, setAllAssignments] = useState<MaterialRoleAssignment[]>([])
    const [roleConfigs, setRoleConfigs] = useState<MaterialRoleConfig[]>([])
    const [materials, setMaterials] = useState<Material[]>([])
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        role: '',
        material_id: 0,
        effective_date: '',
        auto_end_previous: true
    })

    const loadData = async () => {
        try {
            const [activeResp, allResp, rolesResp, matsResp] = await Promise.all([
                axios.get<MaterialRoleAssignment[]>('/api/material-role-assignments?active_only=true'),
                axios.get<MaterialRoleAssignment[]>('/api/material-role-assignments'),
                axios.get<MaterialRoleConfig[]>('/api/material-role-configs'),
                axios.get<Material[]>('/api/materials')
            ])
            setActiveAssignments(activeResp.data)
            setAllAssignments(allResp.data)
            setRoleConfigs(rolesResp.data)
            setMaterials(matsResp.data)
            setError(null)
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load data')
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const getMaterialName = (materialId: number) => {
        const material = materials.find(m => m.id === materialId)
        return material?.name || `Material #${materialId}`
    }

    const getRoleDisplay = (role: string) => {
        const config = roleConfigs.find(c => c.role === role)
        if (config?.display_name) {
            return `${config.display_name} (${role})`
        }
        return role
    }

    const handleCreateAssignment = async () => {
        if (!formData.role || !formData.material_id) {
            setError('Role and Material are required')
            return
        }

        try {
            const payload = {
                role: formData.role.trim().toUpperCase(),
                material_id: formData.material_id,
                effective_date: formData.effective_date || null,
                auto_end_previous: formData.auto_end_previous
            }
            await axios.post('/api/material-role-assignments', payload)
            setFormData({
                role: '',
                material_id: 0,
                effective_date: '',
                auto_end_previous: true
            })
            setError(null)
            loadData()
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create assignment')
        }
    }

    const handleEndAssignment = async (id: number) => {
        if (!confirm('End this assignment? This will set the end_date to now.')) return

        try {
            await axios.post(`/api/material-role-assignments/${id}/end`)
            setError(null)
            loadData()
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to end assignment')
        }
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleString()
    }

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 3 }}>Material Role Assignments</Typography>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Material role assignments map role identifiers (e.g., CHOICE_WATERPROOF_FABRIC) to actual materials.
                    Only one assignment per role can be active at a time (end_date IS NULL).
                </Typography>
            </Paper>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Create Assignment Form */}
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Create Assignment</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <FormControl sx={{ minWidth: 250 }}>
                        <InputLabel>Role</InputLabel>
                        <Select
                            value={formData.role}
                            label="Role"
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                            {roleConfigs.map((rc) => (
                                <MenuItem key={rc.id} value={rc.role}>
                                    {rc.display_name ? `${rc.display_name} (${rc.role})` : rc.role}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl sx={{ minWidth: 250 }}>
                        <InputLabel>Material</InputLabel>
                        <Select
                            value={formData.material_id}
                            label="Material"
                            onChange={(e) => setFormData({ ...formData, material_id: e.target.value as number })}
                        >
                            {materials.map((m) => (
                                <MenuItem key={m.id} value={m.id}>
                                    {m.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Effective Date"
                        type="date"
                        value={formData.effective_date}
                        onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 200 }}
                    />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={formData.auto_end_previous}
                                onChange={(e) => setFormData({ ...formData, auto_end_previous: e.target.checked })}
                            />
                        }
                        label="Auto-end previous"
                        sx={{ mt: 1 }}
                    />

                    <Button
                        variant="contained"
                        onClick={handleCreateAssignment}
                        sx={{ mt: 1 }}
                    >
                        Create Assignment
                    </Button>
                </Box>
            </Paper>

            {/* Active Assignments Table */}
            <Typography variant="h6" sx={{ mb: 2 }}>Active Assignments</Typography>
            <TableContainer component={Paper} sx={{ mb: 4 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Role</TableCell>
                            <TableCell>Material</TableCell>
                            <TableCell>Effective Date</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {activeAssignments.map((assignment) => (
                            <TableRow key={assignment.id}>
                                <TableCell>
                                    <Typography variant="body2">{getRoleDisplay(assignment.role)}</Typography>
                                </TableCell>
                                <TableCell>{getMaterialName(assignment.material_id)}</TableCell>
                                <TableCell>{formatDate(assignment.effective_date)}</TableCell>
                                <TableCell>{formatDate(assignment.created_at)}</TableCell>
                                <TableCell align="right">
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="warning"
                                        onClick={() => handleEndAssignment(assignment.id)}
                                    >
                                        End
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}

                        {activeAssignments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    No active assignments.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Assignment History Table */}
            <Typography variant="h6" sx={{ mb: 2 }}>Assignment History</Typography>
            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Role</TableCell>
                            <TableCell>Material</TableCell>
                            <TableCell>Effective Date</TableCell>
                            <TableCell>End Date</TableCell>
                            <TableCell>Created</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {allAssignments.map((assignment) => (
                            <TableRow
                                key={assignment.id}
                                sx={{ opacity: assignment.end_date ? 0.6 : 1 }}
                            >
                                <TableCell>
                                    <Typography variant="body2">{getRoleDisplay(assignment.role)}</Typography>
                                </TableCell>
                                <TableCell>{getMaterialName(assignment.material_id)}</TableCell>
                                <TableCell>{formatDate(assignment.effective_date)}</TableCell>
                                <TableCell>
                                    {assignment.end_date ? (
                                        formatDate(assignment.end_date)
                                    ) : (
                                        <Typography color="success.main" fontWeight="medium">Active</Typography>
                                    )}
                                </TableCell>
                                <TableCell>{formatDate(assignment.created_at)}</TableCell>
                            </TableRow>
                        ))}

                        {allAssignments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    No assignment history.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    )
}
