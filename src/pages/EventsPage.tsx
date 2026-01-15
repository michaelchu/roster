import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Calendar, Users, Copy } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { eventService, type Event } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { useLoadingState } from '@/hooks/useLoadingState';
import { EventListSkeleton, LoadingSpinner } from '@/components/LoadingStates';
import { formatEventDateTime, isEventCompleted } from '@/lib/utils';

export function EventsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const {
    isLoading: isLoadingOrganizing,
    data: organizingEvents,
    execute: loadOrganizingEvents,
  } = useLoadingState<Event[]>([]);
  const {
    isLoading: isLoadingJoined,
    data: joinedEvents,
    execute: loadJoinedEvents,
  } = useLoadingState<Event[]>([]);
  const {
    isLoading: isLoadingArchived,
    data: archivedEvents,
    execute: loadArchivedEvents,
  } = useLoadingState<Event[]>([]);
  const [duplicatingEventId, setDuplicatingEventId] = useState<string | null>(null);

  const loadOrganizingEventsCallback = useCallback(async () => {
    if (!user) return [];
    const allEvents = await eventService.getEventsByOrganizer(user.id);
    return allEvents.filter((event) => !isEventCompleted(event.datetime, event.end_datetime));
  }, [user]);

  const loadJoinedEventsCallback = useCallback(async () => {
    if (!user) return [];
    const allEvents = await eventService.getEventsByParticipant(user.id);
    return allEvents.filter((event) => !isEventCompleted(event.datetime, event.end_datetime));
  }, [user]);

  const loadArchivedEventsCallback = useCallback(async () => {
    if (!user) return [];
    const allEvents = await eventService.getEventsByOrganizer(user.id);
    return allEvents.filter((event) => isEventCompleted(event.datetime, event.end_datetime));
  }, [user]);

  useEffect(() => {
    if (user) {
      loadOrganizingEvents(loadOrganizingEventsCallback);
      loadJoinedEvents(loadJoinedEventsCallback);
      loadArchivedEvents(loadArchivedEventsCallback);
    }
  }, [
    user,
    loadOrganizingEvents,
    loadJoinedEvents,
    loadArchivedEvents,
    loadOrganizingEventsCallback,
    loadJoinedEventsCallback,
    loadArchivedEventsCallback,
  ]);

  const duplicateEvent = async (event: Event) => {
    if (!user) return;

    setDuplicatingEventId(event.id);
    try {
      const result = await eventService.duplicateEvent(event.id, user.id);
      if (result) {
        errorHandler.success(`"${event.name}" has been duplicated successfully`);
        loadOrganizingEvents(loadOrganizingEventsCallback);
      }
    } catch {
      // Error handling is done by errorHandler in the service
    } finally {
      setDuplicatingEventId(null);
    }
  };

  if (loading) {
    return <EventListSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-32 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-muted-foreground mb-4">Please sign in to view your events</p>
          <Button size="sm" onClick={() => navigate('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  const renderEventList = (
    events: Event[] | null,
    isLoading: boolean,
    showDuplicate: boolean,
    emptyState?: { title: string; description: string }
  ) => {
    if (isLoading) {
      return <EventListSkeleton count={3} />;
    }

    if (!events || events.length === 0) {
      const title = emptyState?.title || (showDuplicate ? 'No Events Yet' : 'No Joined Events');
      const description =
        emptyState?.description ||
        (showDuplicate
          ? 'Create your first event to start managing registrations'
          : "You haven't joined any events yet");

      return (
        <div className="bg-card rounded-lg p-3 border text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <h2 className="text-base font-medium mb-2">{title}</h2>
          <p className="text-xs text-muted-foreground mb-4">{description}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="bg-card border rounded-lg overflow-hidden relative">
            <button
              onClick={() => navigate(`/signup/${event.id}`)}
              className="w-full p-3 text-left hover:bg-muted transition-colors"
            >
              <div className="pr-8 mb-3">
                <h3 className="text-sm font-semibold truncate leading-tight">{event.name}</h3>
                {event.group_name && (
                  <p className="text-xs text-muted-foreground leading-tight">{event.group_name}</p>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {event.datetime && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 flex-shrink-0" />
                    <span>{formatEventDateTime(event.datetime)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span className="font-medium">{event.participant_count || 0}</span>
                </div>
              </div>
            </button>
            {showDuplicate && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-muted-foreground/10"
                disabled={duplicatingEventId === event.id}
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateEvent(event);
                }}
              >
                {duplicatingEventId === event.id ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Tabs defaultValue="organizing" className="w-full">
        <div className="sticky top-0 z-20 bg-background">
          <TopNav />
          <div className="bg-card border-b px-3 py-2">
            <TabsList className="w-full h-10">
              <TabsTrigger value="organizing" className="flex-1">
                Organizing
              </TabsTrigger>
              <TabsTrigger value="joined" className="flex-1">
                Joined
              </TabsTrigger>
              <TabsTrigger value="archive" className="flex-1">
                Archive
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent value="organizing" className="p-3 space-y-3 mt-0 pb-24">
          {renderEventList(organizingEvents, isLoadingOrganizing, true)}
        </TabsContent>

        <TabsContent value="joined" className="p-3 space-y-3 mt-0">
          {renderEventList(joinedEvents, isLoadingJoined, false)}
        </TabsContent>

        <TabsContent value="archive" className="p-3 space-y-3 mt-0">
          {renderEventList(archivedEvents, isLoadingArchived, false, {
            title: 'No Archived Events',
            description: 'Past events will appear here once their date has passed',
          })}
        </TabsContent>
      </Tabs>

      <button
        onClick={() => navigate('/events/new')}
        className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg drop-shadow-md flex items-center justify-center font-medium transition-all"
        aria-label="Create Event"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
