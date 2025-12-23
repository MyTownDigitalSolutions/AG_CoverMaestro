import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Button, FormControl, InputLabel,
    Select, MenuItem, TextField, FormControlLabel, Switch, Alert
} from '@mui/material';
import { settingsApi, materialsApi } from '../../services/api';
import { MaterialRoleAssignment, Material } from '../../types';

export const MaterialRoleSettings: React.FC = () => {
    const [assignments, setAssignments] = useState<MaterialRoleAssignment[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [role, setRole] = useState("CHOICE_WATERPROOF_FABRIC");
    const [materialId, setMaterialId] = useState<number | ''>('');
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

    const ROLES = [
        "CHOICE_WATERPROOF_FABRIC",
        "PREMIUM_SYNTHETIC_LEATHER",
        "PADDING"
    ];

    const loadData = async () => {
        setLoading(true);
        try {
            const [params, mats] = await Promise.all([
                settingsApi.listMaterialRoles(showHistory),
                materialsApi.list()
            ]);
            setAssignments(params);
            setMaterials(mats);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [showHistory]);

    const handleAssign = async () => {
        if (!materialId) return;
        try {
            await settingsApi.assignMaterialRole({
                role,
                material_id: Number(materialId),
                effective_date: new Date(effectiveDate).toISOString()
            });
            loadData();
            alert("Role assigned successfully");
        } catch (e) {
            alert("Error assigning role");
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Material Role Assignments</Typography>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" gutterBottom>Assign New Role</Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Role</InputLabel>
                        <Select value={role} label="Role" onChange={(e) => setRole(e.target.value)}>
                            {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Material</InputLabel>
                        <Select value={materialId} label="Material" onChange={(e) => setMaterialId(e.target.value as number)}>
                            {materials.map(m => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Effective Date"
                        type="date"
                        size="small"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />

                    <Button variant="contained" onClick={handleAssign}>Assign</Button>
                </Box>
            </Paper>

            <FormControlLabel
                control={<Switch checked={showHistory} onChange={e => setShowHistory(e.target.checked)} />}
                label="Show History"
            />

            <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Role</TableCell>
                            <TableCell>Material</TableCell>
                            <TableCell>Effective Date</TableCell>
                            <TableCell>End Date</TableCell>
                            <TableCell>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {assignments.map(a => {
                            const matName = materials.find(m => m.id === a.material_id)?.name || a.material_id;
                            const isActive = !a.end_date || new Date(a.end_date) > new Date();
                            return (
                                <TableRow key={a.id} sx={{ opacity: isActive ? 1 : 0.6 }}>
                                    <TableCell>{a.role}</TableCell>
                                    <TableCell>{matName}</TableCell>
                                    <TableCell>{new Date(a.effective_date).toLocaleDateString()}</TableCell>
                                    <TableCell>{a.end_date ? new Date(a.end_date).toLocaleDateString() : '-'}</TableCell>
                                    <TableCell>{isActive ? "Active" : "Closed"}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};
