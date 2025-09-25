import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CheckCircle, User } from 'lucide-react'

interface CustomField {
  id: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'select'
  required?: boolean
  options?: string[]
}

interface EventData {
  id: string
  name: string
  description: string
  datetime: string
  location: string
  custom_fields: CustomField[]
}

const QUICK_FILL_KEY = 'venu_participant_info'

export function SignupPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    responses: {} as Record<string, any>
  })

  useEffect(() => {
    loadEvent()
    loadQuickFill()
  }, [eventId])

  const loadEvent = async () => {
    if (!eventId) return

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (error) throw error
      setEvent(data)
    } catch (err) {
      setError('Event not found')
    } finally {
      setLoading(false)
    }
  }

  const loadQuickFill = () => {
    const saved = localStorage.getItem(QUICK_FILL_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      setFormData(prev => ({
        ...prev,
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || ''
      }))
    }
  }

  const saveQuickFill = () => {
    localStorage.setItem(QUICK_FILL_KEY, JSON.stringify({
      name: formData.name,
      email: formData.email,
      phone: formData.phone
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event) return

    setSubmitting(true)
    setError('')

    try {
      saveQuickFill()

      const { error } = await supabase
        .from('participants')
        .insert({
          event_id: event.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          responses: formData.responses,
          user_id: user?.id || null // Store user ID if signed in
        })

      if (error) throw error
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Failed to sign up')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Event Not Found</h1>
          <p className="text-sm text-gray-500">This event link is invalid.</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-6 border text-center max-w-sm w-full">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-2">Successfully Registered!</h1>
          <p className="text-sm text-gray-600 mb-4">
            You have been registered for {event.name}
          </p>
          <Button
            size="sm"
            className="w-full"
            onClick={() => navigate('/')}
          >
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">Event Registration</h1>
          <p className="text-xs text-gray-500">{event.name}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {event.description && (
          <div className="bg-white rounded-lg p-4 border">
            <h2 className="text-sm font-medium mb-2">About</h2>
            <p className="text-xs text-gray-600">{event.description}</p>
            {event.datetime && (
              <div className="mt-2 text-xs text-gray-500">
                Date: {new Date(event.datetime).toLocaleDateString()}
              </div>
            )}
            {event.location && (
              <div className="text-xs text-gray-500">
                Location: {event.location}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-lg p-4 border space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <User className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-medium">Your Information</h2>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs">Name *</Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-xs">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            {event.custom_fields && event.custom_fields.length > 0 && (
              <>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Additional Information</h3>
                  {event.custom_fields.map((field) => (
                    <div key={field.id} className="space-y-2 mb-4">
                      <Label htmlFor={field.id} className="text-xs">
                        {field.label} {field.required && '*'}
                      </Label>
                      {field.type === 'select' && field.options ? (
                        <select
                          id={field.id}
                          value={formData.responses[field.id] || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            responses: { ...prev.responses, [field.id]: e.target.value }
                          }))}
                          required={field.required}
                          className="w-full h-9 px-3 text-sm border rounded-md"
                        >
                          <option value="">Select...</option>
                          {field.options.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          id={field.id}
                          type={field.type}
                          value={formData.responses[field.id] || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            responses: { ...prev.responses, [field.id]: e.target.value }
                          }))}
                          required={field.required}
                          className="h-9 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {error && (
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="sm"
              disabled={submitting}
            >
              {submitting ? 'Registering...' : 'Register'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}