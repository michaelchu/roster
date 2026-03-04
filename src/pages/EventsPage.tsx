import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Calendar, Users, Copy, CheckCircle, Clock } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { eventService, participantService, type Event } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { useLoadingState } from '@/hooks/useLoadingState';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { EventListSkeleton, LoadingSpinner } from '@/components/LoadingStates';
import { formatEventDateTime, isEventCompleted } from '@/lib/utils';
import { DuplicateEventDrawer } from '@/components/DuplicateEventDrawer';

type PaymentFilter = 'all' | 'fully_paid' | 'has_unpaid';
type PaymentSummary = { total: number; paid: number; pending: number; waived: number };

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
  const [duplicatingEvent, setDuplicatingEvent] = useState<Event | null>(null);
  const [duplicatingEventId, setDuplicatingEventId] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [paymentSummaries, setPaymentSummaries] = useState<Map<string, PaymentSummary>>(new Map());
  const isEventDuplicationEnabled = useFeatureFlag('event_duplication');
  const hasLoadedRef = useRef(false);

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
    const archived = allEvents.filter((event) =>
      isEventCompleted(event.datetime, event.end_datetime)
    );

    // Fetch payment summaries for archived events
    if (archived.length > 0) {
      const eventIds = archived.map((e) => e.id);
      const summaries = await participantService.getPaymentSummariesBatch(eventIds);
      setPaymentSummaries(summaries);
    } else {
      setPaymentSummaries(new Map());
    }

    return archived;
  }, [user]);

  useEffect(() => {
    if (user && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
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

  // Filter archived events based on payment status
  const filteredArchivedEvents = useMemo(() => {
    if (!archivedEvents || paymentFilter === 'all') return archivedEvents;

    return archivedEvents.filter((event) => {
      const summary = paymentSummaries.get(event.id);
      if (!summary || summary.total === 0) {
        // Events with no participants - show in "all" and "fully_paid" (nothing to pay)
        return paymentFilter === 'fully_paid';
      }

      const isFullyPaid = summary.pending === 0;
      return paymentFilter === 'fully_paid' ? isFullyPaid : !isFullyPaid;
    });
  }, [archivedEvents, paymentFilter, paymentSummaries]);

  const openDuplicateDrawer = (event: Event) => {
    setDuplicatingEvent(event);
  };

  const confirmDuplicate = async (
    name: string,
    datetime: string | null,
    endDatetime: string | null
  ) => {
    if (!user || !duplicatingEvent) return;

    setDuplicatingEventId(duplicatingEvent.id);
    try {
      const result = await eventService.duplicateEvent(duplicatingEvent.id, user.id, {
        name,
        datetime,
        end_datetime: endDatetime,
      });
      if (result) {
        errorHandler.success(`"${duplicatingEvent.name}" has been duplicated successfully`);
        setDuplicatingEvent(null);
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
    emptyState?: { title: string; description: string },
    showPaymentStatus?: boolean
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
        {events.map((event) => {
          const summary = showPaymentStatus ? paymentSummaries.get(event.id) : null;
          const isFullyPaid = summary && summary.total > 0 && summary.pending === 0;

          return (
            <div key={event.id} className="bg-card border rounded-lg overflow-hidden relative">
              <button
                onClick={() => navigate(`/signup/${event.id}`)}
                className="w-full p-3 text-left hover:bg-muted transition-colors"
              >
                <div className="pr-8 mb-3">
                  <h3 className="text-sm font-semibold truncate leading-tight">{event.name}</h3>
                  {event.group_name && (
                    <p className="text-xs text-muted-foreground leading-tight">
                      {event.group_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {event.datetime && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>{formatEventDateTime(event.datetime)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {showPaymentStatus && summary && summary.total > 0 && (
                      <div
                        className={`flex items-center gap-1 ${isFullyPaid ? 'text-green-600' : 'text-amber-600'}`}
                      >
                        {isFullyPaid ? (
                          <>
                            <CheckCircle className="h-3 w-3" />
                            <span className="font-medium">Paid</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">
                              {summary.paid}/{summary.total}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span className="font-medium">{event.participant_count || 0}</span>
                    </div>
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
                    openDuplicateDrawer(event);
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
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Tabs defaultValue="joined" className="w-full">
        <div className="sticky top-0 z-20 bg-background">
          <TopNav />
          <div className="bg-card border-b px-3 py-2 flex justify-center">
            <TabsList className="h-8 p-0.5 bg-background border">
              <TabsTrigger value="joined" className="h-7 px-3 text-xs">
                Joined
              </TabsTrigger>
              <TabsTrigger value="organizing" className="h-7 px-3 text-xs">
                Organizing
              </TabsTrigger>
              <TabsTrigger value="archive" className="h-7 px-3 text-xs">
                Archive
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        <TabsContent value="joined" className="p-3 space-y-3 mt-0">
          {renderEventList(joinedEvents, isLoadingJoined, false)}
        </TabsContent>

        <TabsContent value="organizing" className="p-3 space-y-3 mt-0 pb-24">
          {renderEventList(organizingEvents, isLoadingOrganizing, isEventDuplicationEnabled)}
        </TabsContent>

        <TabsContent value="archive" className="p-3 space-y-3 mt-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Payment:</span>
            <Select
              value={paymentFilter}
              onValueChange={(value) => setPaymentFilter(value as PaymentFilter)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                <SelectItem value="fully_paid">Fully Paid</SelectItem>
                <SelectItem value="has_unpaid">Has Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {renderEventList(
            filteredArchivedEvents,
            isLoadingArchived,
            false,
            {
              title:
                paymentFilter === 'all'
                  ? 'No Archived Events'
                  : paymentFilter === 'fully_paid'
                    ? 'No Fully Paid Events'
                    : 'No Events with Unpaid',
              description:
                paymentFilter === 'all'
                  ? 'Past events will appear here once their date has passed'
                  : 'No archived events match this filter',
            },
            true
          )}
        </TabsContent>
      </Tabs>

      <button
        onClick={() => navigate('/events/new')}
        className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg drop-shadow-md flex items-center justify-center font-medium transition-all"
        aria-label="Create Event"
      >
        <Plus className="h-5 w-5" />
      </button>

      <DuplicateEventDrawer
        open={!!duplicatingEvent}
        onOpenChange={(open) => !open && setDuplicatingEvent(null)}
        eventName={duplicatingEvent?.name || ''}
        datetime={duplicatingEvent?.datetime || null}
        endDatetime={duplicatingEvent?.end_datetime || null}
        submitting={!!duplicatingEventId}
        onConfirm={confirmDuplicate}
      />
    </div>
  );
}
