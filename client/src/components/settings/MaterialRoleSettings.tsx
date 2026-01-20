import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, Button, FormControl, InputLabel,
    Select, MenuItem, TextField, FormControlLabel, Switch
} from '@mui/material';
import { settingsApi, materialsApi } from '../../services/api';
import { MaterialRoleAssignment, Material, MaterialRoleConfig } from '../../types';

export const MaterialRoleSettings: React.FC = () => {
    const [assignments, setAssignments] = useState<MaterialRoleAssignment[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [roleConfigs, setRoleConfigs] = useState<MaterialRoleConfig[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [, setLoading] = useState(false);

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
            const [params, mats, configs] = await Promise.all([
                settingsApi.listMaterialRoles(showHistory),
                materialsApi.list(),
                settingsApi.listMaterialRoleConfigs()
            ]);
            setAssignments(params);
            setMaterials(mats);
            setRoleConfigs(configs);
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

    // Helper to format role SKU pair (noPad, withPad)
    const formatRoleSkuPair = (noPad?: string, withPad?: string): string => {
        const validateAbbrev = (abbrev?: string): string | null => {
            const trimmed = abbrev?.trim();
            if (!trimmed) return null;
            if (trimmed.length > 3) return `${trimmed} (>3)`;
            return trimmed;
        };

        const validNoPad = validateAbbrev(noPad);
        const validWithPad = validateAbbrev(withPad);

        if (validNoPad && validWithPad && validNoPad !== validWithPad) {
            return `${validNoPad}, ${validWithPad}`;
        }
        if (validNoPad) return validNoPad;
        if (validWithPad) return validWithPad;
        return '-';
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
                            <TableCell>Material SKU</TableCell>
                            <TableCell>Effective Date</TableCell>
                            <TableCell>End Date</TableCell>
                            <TableCell>Status</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {assignments.map(a => {
                            const material = materials.find(m => m.id === a.material_id);
                            const matName = material?.name || a.material_id;

                            // Use role config abbreviations if available
                            const roleConfig = roleConfigs.find(rc => rc.role === a.role);
                            const matSku = roleConfig
                                ? formatRoleSkuPair(roleConfig.sku_abbrev_no_padding, roleConfig.sku_abbrev_with_padding)
                                : (() => {
                                    const abbrev = material?.sku_abbreviation?.trim();
                                    if (!abbrev) return '-';
                                    if (abbrev.length > 3) return `${abbrev} (>3)`;
                                    return abbrev;
                                })();

                            const isActive = !a.end_date || new Date(a.end_date) > new Date();
                            return (
                                <TableRow key={a.id} sx={{ opacity: isActive ? 1 : 0.6 }}>
                                    <TableCell>{a.role}</TableCell>
                                    <TableCell>{matName}</TableCell>
                                    <TableCell>{matSku}</TableCell>
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
