
import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Alert, Paper } from '@mui/material';
import { settingsApi } from '../../services/api';
import { ExportSetting } from '../../types';

export const ExportSettings: React.FC = () => {
    const [setting, setSetting] = useState<ExportSetting | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const data = await settingsApi.getExport();
            setSetting(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load export settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!setting) return;
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);
            const updated = await settingsApi.updateExport({
                default_save_path_template: setting.default_save_path_template
            });
            setSetting(updated);
            setSuccess('Export settings saved successfully');
        } catch (err) {
            console.error(err);
            setError('Failed to save export settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Typography>Loading...</Typography>;

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Export Configuration</Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

            <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>Default Save Path Template</Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                    Define the default folder structure for generated Amazon export files.
                    You can use placeholders like <code>[Manufacturer_Name]</code>, <code>[Series_Name]</code>, and <code>[Marketplace]</code>.
                </Typography>
                <Typography variant="caption" display="block" sx={{ mb: 1, fontFamily: 'monospace', bgcolor: '#f5f5f5', p: 1 }}>
                    Example: C:\MyFiles\Exports\[Manufacturer_Name]\[Series_Name]
                </Typography>

                <TextField
                    fullWidth
                    label="Path Template"
                    value={setting?.default_save_path_template || ''}
                    onChange={(e) => setSetting(prev => prev ? { ...prev, default_save_path_template: e.target.value } : null)}
                    helperText="Note: Actual file saving to this path requires browser permission or manual selection."
                    sx={{ mb: 2 }}
                />

                <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
            </Paper>
        </Box>
    );
};
