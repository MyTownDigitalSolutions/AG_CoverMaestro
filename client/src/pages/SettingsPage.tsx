
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Container, Typography, Box, Tabs, Tab, Paper, Grid, TextField, Button } from '@mui/material';
import { settingsApi } from '../services/api';
import { LaborSetting, MarketplaceFeeRate, VariantProfitSetting } from '../types';
import { MaterialRoleSettings } from '../components/settings/MaterialRoleSettings';
import { ShippingSettings } from '../components/settings/ShippingSettings';
import { ExportSettings } from '../components/settings/ExportSettings';

interface GeneralSettingsProps {
    labor: LaborSetting | null;
    fees: MarketplaceFeeRate[];
    profits: VariantProfitSetting[];
    onRefresh: () => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ labor, fees, profits, onRefresh }) => {
    const [localLabor, setLocalLabor] = useState<LaborSetting | null>(null);

    useEffect(() => {
        if (labor) setLocalLabor({ ...labor });
    }, [labor]);

    const handleLaborSave = async () => {
        if (!localLabor) return;
        try {
            await settingsApi.updateLabor(localLabor);
            onRefresh();
            alert('Labor settings saved');
        } catch (e) {
            alert('Error saving labor settings');
        }
    };

    const handleProfitSave = async (setting: VariantProfitSetting, newCents: number) => {
        try {
            await settingsApi.updateProfit({ ...setting, profit_cents: newCents });
            onRefresh();
        } catch (e) {
            alert('Error saving profit');
        }
    };

    const handleFeeSave = async (setting: MarketplaceFeeRate, newRate: number) => {
        try {
            await settingsApi.updateFee({ ...setting, fee_rate: newRate });
            onRefresh();
        } catch (e) {
            alert('Error saving fee');
        }
    };

    if (!localLabor) return <Typography>Loading...</Typography>;

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Labor Settings</Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={4}>
                    <TextField
                        label="Hourly Rate (Cents)"
                        type="number"
                        fullWidth
                        value={localLabor.hourly_rate_cents}
                        onChange={e => setLocalLabor({ ...localLabor, hourly_rate_cents: parseInt(e.target.value) })}
                    />
                </Grid>
                <Grid item xs={4}>
                    <TextField
                        label="Mins (No Padding)"
                        type="number"
                        fullWidth
                        value={localLabor.minutes_no_padding}
                        onChange={e => setLocalLabor({ ...localLabor, minutes_no_padding: parseInt(e.target.value) })}
                    />
                </Grid>
                <Grid item xs={4}>
                    <TextField
                        label="Mins (With Padding)"
                        type="number"
                        fullWidth
                        value={localLabor.minutes_with_padding}
                        onChange={e => setLocalLabor({ ...localLabor, minutes_with_padding: parseInt(e.target.value) })}
                    />
                </Grid>
                <Grid item xs={12}>
                    <Button variant="contained" onClick={handleLaborSave}>Save Labor Settings</Button>
                </Grid>
            </Grid>

            <Typography variant="h6" gutterBottom>Marketplace Fee Rates</Typography>
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {fees.map(f => (
                    <Grid item xs={3} key={f.marketplace}>
                        <TextField
                            label={f.marketplace}
                            type="number"
                            inputProps={{ step: "0.01" }}
                            fullWidth
                            defaultValue={f.fee_rate}
                            onBlur={(e) => handleFeeSave(f, parseFloat(e.target.value))}
                        />
                    </Grid>
                ))}
            </Grid>

            <Typography variant="h6" gutterBottom>Variant Profits (Cents)</Typography>
            <Grid container spacing={2}>
                {profits.map(p => (
                    <Grid item xs={3} key={p.variant_key}>
                        <TextField
                            label={p.variant_key.replace(/_/g, ' ')}
                            type="number"
                            fullWidth
                            defaultValue={p.profit_cents}
                            onBlur={(e) => handleProfitSave(p, parseInt(e.target.value))}
                        />
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

// Tab Key Mapping
const TAB_MAPPING: Record<string, number> = {
    'general': 0,
    'material-roles': 1,
    'shipping': 2,
    'export': 3
};

const SettingsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [tabIndex, setTabIndex] = useState(0);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && TAB_MAPPING[tab] !== undefined) {
            setTabIndex(TAB_MAPPING[tab]);
        }
    }, [searchParams]);

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setTabIndex(newValue);
        const newKey = Object.keys(TAB_MAPPING).find(key => TAB_MAPPING[key] === newValue);
        if (newKey) {
            setSearchParams({ tab: newKey }, { replace: true });
        }
    };

    const [labor, setLabor] = useState<LaborSetting | null>(null);
    const [fees, setFees] = useState<MarketplaceFeeRate[]>([]);
    const [profits, setProfits] = useState<VariantProfitSetting[]>([]);

    const fetchData = async () => {
        try {
            const [l, f, p] = await Promise.all([
                settingsApi.getLabor(),
                settingsApi.listFees(),
                settingsApi.listProfits()
            ]);
            setLabor(l);
            setFees(f);
            setProfits(p);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" gutterBottom>Global Settings</Typography>
            <Paper sx={{ width: '100%', mb: 2 }}>
                <Tabs value={tabIndex} onChange={handleTabChange}>
                    <Tab label="General (Labor/Fees/Profit)" />
                    <Tab label="Material Roles" />
                    <Tab label="Shipping Config" />
                    <Tab label="Export Config" />
                </Tabs>

                {tabIndex === 0 && <GeneralSettings labor={labor} fees={fees} profits={profits} onRefresh={fetchData} />}
                {tabIndex === 1 && <MaterialRoleSettings />}
                {tabIndex === 2 && <ShippingSettings />}
                {tabIndex === 3 && <ExportSettings />}
            </Paper>
        </Container>
    );
};

export default SettingsPage;
