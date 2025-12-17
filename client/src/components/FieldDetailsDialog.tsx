import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Chip,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import type { ProductTypeField } from '../types'
import { templatesApi } from '../services/api'

interface FieldDetailsDialogProps {
  field: ProductTypeField
  onClose: () => void
  onUpdate: (updatedField: ProductTypeField) => void
}

export default function FieldDetailsDialog({ field, onClose, onUpdate }: FieldDetailsDialogProps) {
  const [validValues, setValidValues] = useState(field.valid_values)
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  const handleAddValue = async () => {
    if (!newValue.trim()) return
    
    setSaving(true)
    setError(null)
    try {
      const addedValue = await templatesApi.addFieldValue(field.id, newValue.trim())
      const newValidValues = [...validValues, addedValue]
      setValidValues(newValidValues)
      setNewValue('')
      setHasChanges(true)
      onUpdate({ ...field, valid_values: newValidValues })
    } catch (err: any) {
      if (err.response?.data?.detail === 'Value already exists') {
        setError('This value already exists')
      } else {
        setError('Failed to add value')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteValue = async (valueId: number) => {
    setSaving(true)
    setError(null)
    try {
      await templatesApi.deleteFieldValue(field.id, valueId)
      const newValidValues = validValues.filter(v => v.id !== valueId)
      setValidValues(newValidValues)
      setHasChanges(true)
      onUpdate({ ...field, valid_values: newValidValues })
    } catch (err) {
      setError('Failed to delete value')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddValue()
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Field Details: {field.field_name}
      </DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Field Name</Typography>
            <Typography variant="body1">{field.field_name}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Display Name</Typography>
            <Typography variant="body1">{field.display_name || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Attribute Group</Typography>
            <Typography variant="body1">{field.attribute_group || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Description</Typography>
            <Typography variant="body1">{field.description || '-'}</Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="h6" gutterBottom>
            Valid Values ({validValues.length})
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {validValues.length > 0 
              ? 'These are the allowed values for this field. You can add or remove values as needed.'
              : 'This field accepts any value (no restrictions). Add values to create a dropdown list.'}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small"
              placeholder="Add new value..."
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={saving}
              sx={{ flexGrow: 1 }}
            />
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <AddIcon />}
              onClick={handleAddValue}
              disabled={saving || !newValue.trim()}
            >
              Add
            </Button>
          </Box>

          {validValues.length > 0 && (
            <Box sx={{ 
              maxHeight: 300, 
              overflowY: 'auto', 
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              p: 1
            }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {validValues.map((value) => (
                  <Chip
                    key={value.id}
                    label={value.value}
                    onDelete={() => handleDeleteValue(value.id)}
                    deleteIcon={<DeleteIcon />}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {hasChanges ? 'Done' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
