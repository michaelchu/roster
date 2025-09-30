import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Users, CreditCard, Bookmark, UsersRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { TopNav } from '@/components/TopNav';
import { type Participant } from '@/services/participantService';
import { UpcomingEventsListSkeleton } from '@/components/LoadingStates';
import { formatEventDateTime } from '@/lib/utils';

interface UpcomingEvent {
  id: string;
  name: string;
  datetime: string | null;
  location: string | null;
  isOrganizer: boolean;
  participantCount?: number;
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState<'all' | 'week' | 'month' | 'year'>('all');

  useEffect(() => {
    if (user) {
      loadUpcomingEvents();
    }
  }, [user, timePeriod]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUpcomingEvents = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (timePeriod === 'all') {
        // For 'all', just use current time as start date and far future as end date
        startDate = new Date(now);
        endDate = new Date('2099-12-31'); // Far future date
      } else if (timePeriod === 'week') {
        // Get start and end of current week
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Sunday
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Saturday
        endDate.setHours(23, 59, 59, 999);
      } else if (timePeriod === 'month') {
        // Get start and end of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Get start and end of current year
        startDate = new Date(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(now.getFullYear() + 1, 0, 0); // Last day of current year
        endDate.setHours(23, 59, 59, 999);
      }

      const events: UpcomingEvent[] = [];

      // Get events the user organized with participant counts in a single query
      const { data: organizedEventsWithCounts } = await supabase
        .from('events')
        .select(
          `
          id,
          name,
          datetime,
          location,
          participants!left(id)
        `
        )
        .eq('organizer_id', user?.id || '')
        .gte('datetime', now.toISOString()) // Only future events
        .lte('datetime', endDate.toISOString())
        .order('datetime', { ascending: true });

      if (organizedEventsWithCounts) {
        // Add organized events with their participant counts
        for (const event of organizedEventsWithCounts) {
          events.push({
            id: event.id,
            name: event.name,
            datetime: event.datetime,
            location: event.location,
            isOrganizer: true,
            participantCount: (event.participants as Participant[])?.length || 0,
          });
        }
      }

      // Get events the user signed up for as a participant (if they have user_id stored)
      const { data: participantEvents } = await supabase
        .from('participants')
        .select(
          `
          events!inner (
            id,
            name,
            datetime,
            location,
            organizer_id
          )
        `
        )
        .eq('user_id', user?.id || '')
        .gte('events.datetime', now.toISOString()) // Only future events
        .lte('events.datetime', endDate.toISOString());

      if (participantEvents) {
        for (const participantEvent of participantEvents) {
          const eventData = participantEvent.events as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const event = Array.isArray(eventData) ? eventData[0] : eventData;
          // Don't duplicate events the user is organizing
          if (event?.organizer_id !== user?.id) {
            events.push({
              id: event.id,
              name: event.name,
              datetime: event.datetime,
              location: event.location,
              isOrganizer: false,
            });
          }
        }
      }

      // Sort all events by datetime
      events.sort((a, b) => {
        if (!a.datetime) return 1;
        if (!b.datetime) return -1;
        return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      });

      setUpcomingEvents(events);
    } catch (error) {
      console.error('Error loading upcoming events:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-14">
      <TopNav title="Roster" />

      <div className="p-3 space-y-3">
        {user ? (
          <>
            <div className="bg-card rounded-lg p-3 border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium">Quick Actions</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-20 flex-col gap-2"
                  onClick={() => navigate('/groups/new')}
                >
                  <UsersRound className="h-5 w-5" />
                  <span className="text-xs">Create Group</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-20 flex-col gap-2"
                  onClick={() => navigate('/events/new')}
                >
                  <Calendar className="h-5 w-5" />
                  <span className="text-xs">Create Event</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-20 flex-col gap-2"
                  onClick={() => navigate('/payments')}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs">Payments</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-20 flex-col gap-2"
                  onClick={() => navigate('/bookmarked')}
                >
                  <Bookmark className="h-5 w-5" />
                  <span className="text-xs">Bookmarked</span>
                </Button>
              </div>
            </div>

            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium">Upcoming Events</h2>
                  <Select
                    value={timePeriod}
                    onValueChange={(value: 'all' | 'week' | 'month' | 'year') =>
                      setTimePeriod(value)
                    }
                  >
                    <SelectTrigger className="w-20 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-0 w-20">
                      <SelectItem value="all" className="text-xs py-1 px-2">
                        All
                      </SelectItem>
                      <SelectItem value="week" className="text-xs py-1 px-2">
                        Week
                      </SelectItem>
                      <SelectItem value="month" className="text-xs py-1 px-2">
                        Month
                      </SelectItem>
                      <SelectItem value="year" className="text-xs py-1 px-2">
                        Year
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <UpcomingEventsListSkeleton count={3} />
              ) : upcomingEvents.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">
                  No events{' '}
                  {timePeriod === 'all'
                    ? 'found'
                    : timePeriod === 'week'
                      ? 'this week'
                      : timePeriod === 'month'
                        ? 'this month'
                        : 'this year'}
                </div>
              ) : (
                <div className="divide-y">
                  {upcomingEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => navigate(`/signup/${event.id}`)}
                      className="w-full p-3 text-left hover:bg-muted transition-colors"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-sm font-semibold truncate flex-1 min-w-0 pr-2">
                            {event.name}
                          </h3>
                          <Badge
                            variant={event.isOrganizer ? 'default' : 'secondary'}
                            className="text-xs h-5 px-2 flex-shrink-0"
                          >
                            {event.isOrganizer ? 'Organizer' : 'Attending'}
                          </Badge>
                        </div>
                        <div className="flex items-end justify-between">
                          <div className="space-y-1 flex-1 min-w-0">
                            {event.datetime && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3 flex-shrink-0" />
                                <span>{formatEventDateTime(event.datetime)}</span>
                              </div>
                            )}
                            {event.location && (
                              <div className="text-xs text-muted-foreground truncate">
                                📍 {event.location}
                              </div>
                            )}
                          </div>
                          {event.isOrganizer && event.participantCount !== undefined && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                              <Users className="h-3 w-3" />
                              <span className="font-medium">{event.participantCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="bg-card rounded-lg p-6 border text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h2 className="text-base font-medium mb-2">Welcome to Roster</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Sign in to create and manage your events
              </p>
              <Button size="sm" className="w-full" onClick={() => navigate('/auth/login')}>
                Sign In
              </Button>
            </div>

            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="p-3 border-b bg-muted">
                <h3 className="text-sm font-medium">About This App</h3>
              </div>
              <div className="p-3">
                <div className="text-xs text-muted-foreground space-y-3">
                  <div>
                    <p className="mb-2">
                      Roster is a mobile-first event management platform designed to streamline
                      event registration and participant management. Create events, manage signups,
                      and track attendance all from your mobile device.
                    </p>
                  </div>

                  <div>
                    <div className="font-medium text-foreground mb-2">Install Mobile App</div>
                    <div className="space-y-2">
                      <div>
                        <div className="font-medium">For iPhone/iPad:</div>
                        <div>1. Open this website in Safari</div>
                        <div>2. Tap the Share button (square with arrow)</div>
                        <div>3. Select "Add to Home Screen"</div>
                        <div>4. Tap "Add" to confirm</div>
                      </div>

                      <div>
                        <div className="font-medium">For Android:</div>
                        <div>1. Open this website in Chrome</div>
                        <div>2. Tap the menu (three dots)</div>
                        <div>3. Select "Add to Home screen"</div>
                        <div>4. Tap "Add" to confirm</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
