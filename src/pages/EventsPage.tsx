import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Plus, Calendar, Users, Copy, Edit } from 'lucide-react'

interface Event {
  id: string
  name: string
  description: string | null
  datetime: string | null
  location: string | null
  created_at: string
  participant_count?: number
}

export function EventsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadEvents()
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadEvents = async () => {
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('organizer_id', user?.id)
        .order('created_at', { ascending: false })

      if (eventsError) throw eventsError

      // Get participant counts
      if (eventsData && eventsData.length > 0) {
        const eventIds = eventsData.map(e => e.id)
        const { data: participantCounts } = await supabase
          .from('participants')
          .select('event_id')
          .in('event_id', eventIds)

        const countMap = participantCounts?.reduce((acc, p) => {
          acc[p.event_id] = (acc[p.event_id] || 0) + 1
          return acc
        }, {} as Record<string, number>) || {}

        const eventsWithCounts = eventsData.map(event => ({
          ...event,
          participant_count: countMap[event.id] || 0
        }))

        setEvents(eventsWithCounts)
      } else {
        setEvents([])
      }
    } catch (error) {
      console.error('Error loading events:', error)
    } finally {
      setLoading(false)
    }
  }

  const duplicateEvent = async (event: Event) => {
    try {
      // Get full event details including custom fields
      const { data: originalEvent, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .eq('id', event.id)
        .single()

      if (fetchError) throw fetchError

      // Create new event
      const { data: newEvent, error: createError } = await supabase
        .from('events')
        .insert({
          organizer_id: user?.id,
          name: `${originalEvent.name} (Copy)`,
          description: originalEvent.description,
          datetime: originalEvent.datetime,
          location: originalEvent.location,
          custom_fields: originalEvent.custom_fields,
          parent_event_id: originalEvent.id
        })
        .select()
        .single()

      if (createError) throw createError

      // Copy labels
      const { data: labels } = await supabase
        .from('labels')
        .select('*')
        .eq('event_id', event.id)

      if (labels && labels.length > 0) {
        await supabase
          .from('labels')
          .insert(
            labels.map(label => ({
              event_id: newEvent.id,
              name: label.name,
              color: label.color
            }))
          )
      }

      loadEvents()
    } catch (error) {
      console.error('Error duplicating event:', error)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pb-32 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-gray-500 mb-4">
            Please sign in to view your events
          </p>
          <Button
            size="sm"
            onClick={() => navigate('/auth/login')}
          >
            Sign In
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-2">
          <h1 className="text-lg font-semibold text-center">My Events</h1>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {loading ? (
          <div className="text-sm text-gray-500 text-center py-8">Loading...</div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-lg p-3 border text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <h2 className="text-base font-medium mb-2">No Events Yet</h2>
            <p className="text-xs text-gray-500 mb-4">
              Create your first event to start managing registrations
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={() => navigate('/events/new')}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Event
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold truncate">
                      {event.name}
                    </h3>
                  </div>
                  {(event.datetime || event.location) && (
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      {event.datetime && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          <span>
                            {new Date(event.datetime).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric"
                            })}
                          </span>
                        </div>
                      )}
                      {event.location && (
                        <div className="text-xs text-gray-500 truncate ml-2">
                          📍 {event.location}
                        </div>
                      )}
                    </div>
                  )}
                </button>
                <div className="border-t px-3 py-2 bg-gray-50 flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    <Users className="h-3 w-3" />
                    <span className="font-medium">{event.participant_count || 0}</span>
                  </div>
                  <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/events/${event.id}/edit`)
                    }}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      duplicateEvent(event)
                    }}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Duplicate
                  </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Event Button above navbar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
        <Button
          onClick={() => navigate('/events/new')}
          className="w-full text-white shadow-lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          New Event
        </Button>
      </div>
    </div>
  )
}