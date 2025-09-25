import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { ArrowLeft, Plus, Trash2, Minus } from 'lucide-react'

interface CustomField {
  id: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'select'
  required: boolean
  options?: string[]
}

export function NewEventPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    datetime: '',
    location: '',
    max_participants: null as number | null
  })
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [maxParticipants, setMaxParticipants] = useState<number>(50)

  const addCustomField = () => {
    const newField: CustomField = {
      id: Date.now().toString(),
      label: '',
      type: 'text',
      required: false
    }
    setCustomFields([...customFields, newField])
  }

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields(customFields.map(field =>
      field.id === id ? { ...field, ...updates } : field
    ))
  }

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(field => field.id !== id))
  }

  const incrementMaxParticipants = () => {
    setMaxParticipants(prev => Math.min(prev + 1, 999))
  }

  const decrementMaxParticipants = () => {
    setMaxParticipants(prev => Math.max(prev - 1, 1))
  }

  const handleMaxParticipantsChange = (value: string) => {
    const num = parseInt(value)
    if (!isNaN(num) && num >= 1 && num <= 999) {
      setMaxParticipants(num)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          organizer_id: user.id,
          name: formData.name,
          description: formData.description || null,
          datetime: formData.datetime || null,
          location: formData.location || null,
          max_participants: maxParticipants,
          custom_fields: customFields.filter(f => f.label)
        })
        .select()
        .single()

      if (error) throw error
      navigate(`/events/${data.id}`)
    } catch (error) {
      console.error('Error creating event:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => navigate('/events')}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Create Event</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div className="bg-white rounded-lg p-4 border space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">Event Name *</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm">Description</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border rounded-md resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="datetime" className="text-sm">Date & Time</Label>
            <Input
              id="datetime"
              type="datetime-local"
              value={formData.datetime}
              onChange={(e) => setFormData(prev => ({ ...prev, datetime: e.target.value }))}
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm">Location</Label>
            <Input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Max Participants</Label>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0"
                onClick={decrementMaxParticipants}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={maxParticipants}
                onChange={(e) => handleMaxParticipantsChange(e.target.value)}
                className="h-10 text-sm text-center"
                min="1"
                max="999"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0"
                onClick={incrementMaxParticipants}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Custom Fields</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={addCustomField}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Field
            </Button>
          </div>

          {customFields.length === 0 ? (
            <p className="text-xs text-gray-500">
              No custom fields. Add fields to collect additional information from participants.
            </p>
          ) : (
            <div className="space-y-3">
              {customFields.map((field) => (
                <div key={field.id} className="p-3 bg-gray-50 rounded space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
                      placeholder="Field label"
                      className="flex-1 h-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(field.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={field.type}
                      onChange={(e) => updateCustomField(field.id, {
                        type: e.target.value as CustomField['type'],
                        options: e.target.value === 'select' ? [''] : undefined
                      })}
                      className="flex-1 h-9 px-2 text-sm border rounded"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="number">Number</option>
                      <option value="select">Dropdown</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateCustomField(field.id, { required: e.target.checked })}
                      />
                      Required
                    </label>
                  </div>
                  {field.type === 'select' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Options (one per line)</Label>
                      <textarea
                        value={field.options?.join('\n') || ''}
                        onChange={(e) => updateCustomField(field.id, {
                          options: e.target.value.split('\n').filter(Boolean)
                        })}
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                        className="w-full px-2 py-1 text-sm border rounded resize-none"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          size="sm"
          disabled={loading}
        >
          {loading ? 'Creating...' : 'Create Event'}
        </Button>
      </form>
    </div>
  )
}