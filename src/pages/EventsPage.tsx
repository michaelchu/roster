import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Calendar, Users, Copy, Edit } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { eventService, type Event } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { useLoadingState } from '@/hooks/useLoadingState';
import { EventListSkeleton, LoadingSpinner } from '@/components/LoadingStates';

type TabType = 'organizing' | 'joined';

export function EventsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('organizing');
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
  const { isLoading: isDuplicating, execute: duplicateEventAsync } = useLoadingState<Event>();

  const loadOrganizingEventsCallback = useCallback(async () => {
    if (!user) return [];
    return await eventService.getEventsByOrganizer(user.id);
  }, [user]);

  const loadJoinedEventsCallback = useCallback(async () => {
    if (!user) return [];
    return await eventService.getEventsByParticipant(user.id);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadOrganizingEvents(loadOrganizingEventsCallback);
      loadJoinedEvents(loadJoinedEventsCallback);
    }
  }, [
    user,
    loadOrganizingEvents,
    loadJoinedEvents,
    loadOrganizingEventsCallback,
    loadJoinedEventsCallback,
  ]);

  const duplicateEvent = async (event: Event) => {
    if (!user) return;

    const result = await duplicateEventAsync(async () => {
      return await eventService.duplicateEvent(event.id, user.id);
    });

    if (result) {
      errorHandler.success(`"${event.name}" has been duplicated successfully`);
      loadOrganizingEvents(loadOrganizingEventsCallback);
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

  const currentEvents = activeTab === 'organizing' ? organizingEvents : joinedEvents;
  const isLoading = activeTab === 'organizing' ? isLoadingOrganizing : isLoadingJoined;
  const showDuplicateButton = activeTab === 'organizing';

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav title="My Events" sticky />

      {/* Tab Bar */}
      <div className="bg-card border-b px-3 py-2">
        <div className="flex rounded-lg bg-muted p-1">
          <button
            onClick={() => setActiveTab('organizing')}
            className={`flex-1 text-sm font-medium py-2 px-3 rounded-md transition-colors ${
              activeTab === 'organizing'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Organizing
          </button>
          <button
            onClick={() => setActiveTab('joined')}
            className={`flex-1 text-sm font-medium py-2 px-3 rounded-md transition-colors ${
              activeTab === 'joined'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Joined
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {isLoading ? (
          <EventListSkeleton count={3} />
        ) : currentEvents && currentEvents.length === 0 ? (
          <div className="bg-card rounded-lg p-3 border text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-base font-medium mb-2">
              {activeTab === 'organizing' ? 'No Events Yet' : 'No Joined Events'}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {activeTab === 'organizing'
                ? 'Create your first event to start managing registrations'
                : "You haven't joined any events yet"}
            </p>
            {activeTab === 'organizing' && (
              <Button size="sm" className="w-full" onClick={() => navigate('/events/new')}>
                <Plus className="h-4 w-4 mr-1" />
                Create Event
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {(currentEvents || []).map((event) => (
              <div key={event.id} className="bg-card border rounded-lg overflow-hidden relative">
                <button
                  onClick={() => navigate(`/signup/${event.id}`)}
                  className="w-full p-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="mb-3 pr-8">
                    <h3 className="text-sm font-semibold truncate">{event.name}</h3>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {event.datetime && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span>
                          {new Date(event.datetime).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span className="font-medium">{event.participant_count || 0}</span>
                    </div>
                  </div>
                </button>
                {showDuplicateButton && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-muted-foreground/10"
                    disabled={isDuplicating}
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateEvent(event);
                    }}
                  >
                    {isDuplicating ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Event Button above navbar - only show for organizing tab */}
      {activeTab === 'organizing' && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <Button onClick={() => navigate('/events/new')} className="w-full text-white shadow-lg">
            <Plus className="h-5 w-5 mr-2" />
            New Event
          </Button>
        </div>
      )}
    </div>
  );
}
