import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Users, Plus, UsersRound, Share2, Edit, Copy, Clock } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { groupService, eventService, participantService, type Group } from '@/services';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { errorHandler } from '@/lib/errorHandler';
import { useLoadingState } from '@/hooks/useLoadingState';
import { EventListSkeleton, LoadingSpinner } from '@/components/LoadingStates';
import type { Tables } from '@/types/app.types';
import { formatEventDateTime, isEventCompleted } from '@/lib/utils';
import { DuplicateEventDrawer } from '@/components/DuplicateEventDrawer';

interface GroupEvent extends Tables<'events'> {
  participant_count?: number;
  _unsettled?: boolean;
}

export function GroupDetailPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [eventFilter, setEventFilter] = useState<'active' | 'archived'>('active');
  const [duplicatingEvent, setDuplicatingEvent] = useState<GroupEvent | null>(null);
  const [duplicatingEventId, setDuplicatingEventId] = useState<string | null>(null);
  const isEventDuplicationEnabled = useFeatureFlag('event_duplication');
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const isAdminRef = useRef(false);
  const {
    isLoading: eventsLoading,
    data: events,
    execute: loadEvents,
  } = useLoadingState<GroupEvent[]>([]);

  const loadGroup = useCallback(async () => {
    if (!groupId || loadingRef.current) return false;

    try {
      loadingRef.current = true;
      setGroupLoading(true);
      const groupData = await groupService.getGroupById(groupId);
      setGroup(groupData);

      // Load member count
      const members = await groupService.getGroupParticipants(groupId);
      setMemberCount(members.length);

      // Check if current user is admin or owner
      if (user?.id) {
        const adminStatus = await groupService.isGroupAdmin(groupId, user.id);
        isAdminRef.current = adminStatus;
        setIsAdmin(adminStatus);
      }
      return true;
    } catch (error) {
      errorHandler.handle(error, { action: 'load group' });
      navigate('/groups', { replace: true });
      return false;
    } finally {
      setGroupLoading(false);
      loadingRef.current = false;
    }
  }, [groupId, navigate, user?.id]);

  const loadEventsCallback = useCallback(async (): Promise<GroupEvent[]> => {
    if (!groupId) return [];
    const allEvents: GroupEvent[] = await groupService.getGroupEvents(groupId);

    // Mark past paid events with unsettled payments
    const pastPaidEvents = allEvents.filter(
      (e) => e.is_paid && isEventCompleted(e.datetime, e.end_datetime)
    );
    if (pastPaidEvents.length > 0) {
      const pastPaidIds = pastPaidEvents.map((e) => e.id);

      if (isAdminRef.current) {
        // Admins: event is unsettled if any participant has pending payments
        const summaries = await participantService.getPaymentSummariesBatch(pastPaidIds);
        for (const event of pastPaidEvents) {
          const summary = summaries.get(event.id);
          event._unsettled = !!(summary && summary.pending > 0);
        }
      } else if (user?.id) {
        // Non-admins: event is unsettled only if their own payment is pending
        const myStatuses = await participantService.getMyPaymentStatusBatch(user.id, pastPaidIds);
        for (const event of pastPaidEvents) {
          event._unsettled = myStatuses.get(event.id) === 'pending';
        }
      }
    }

    return allEvents;
  }, [groupId, user?.id]);

  const handleInvite = useCallback(async () => {
    if (!group) return;

    const inviteLink = `${window.location.origin}/invite/group/${group.id}`;

    const fallbackCopy = () => {
      if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
        window.prompt('Copy invite link', inviteLink);
      }
    };

    try {
      if (!navigator?.clipboard?.writeText) {
        fallbackCopy();
        errorHandler.info('Clipboard access is unavailable. Copy the invite link manually.');
        return;
      }

      await navigator.clipboard.writeText(inviteLink);
      errorHandler.success('Invite link copied to clipboard!');
    } catch (error) {
      fallbackCopy();
      errorHandler.handle(
        error instanceof Error ? error : new Error('Failed to copy invite link'),
        undefined,
        false
      );
      errorHandler.info('Clipboard access is unavailable. Copy the invite link manually.');
    }
  }, [group]);

  const openDuplicateDrawer = (event: GroupEvent) => {
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
        loadEvents(loadEventsCallback);
      }
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'duplicateEvent',
        metadata: { eventId: duplicatingEvent.id },
      });
    } finally {
      setDuplicatingEventId(null);
    }
  };

  useEffect(() => {
    if (user && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      // Only load events if group loads successfully
      loadGroup().then((success) => {
        if (success) {
          loadEvents(loadEventsCallback);
        }
      });
    }
  }, [user, loadGroup, loadEvents, loadEventsCallback]);

  if (authLoading || groupLoading) {
    return <EventListSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-muted-foreground mb-4">Please sign in to view this group</p>
          <Button size="sm" onClick={() => navigate('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Group Not Found</h1>
          <p className="text-sm text-muted-foreground mb-4">
            The group you're looking for doesn't exist
          </p>
          <Button size="sm" onClick={() => navigate('/groups')}>
            Back to Groups
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav sticky />

      <div className="p-3 space-y-3">
        {/* Group Info Card */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h1 className="text-lg font-semibold mb-1">{group.name}</h1>
                {group.description && (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{events?.length || 0} events</span>
              </div>
              <div className="flex items-center gap-1">
                <UsersRound className="h-4 w-4" />
                <span>
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="border-t bg-muted">
            <div className="flex divide-x divide-border">
              {isAdmin && (
                <button
                  onClick={() => navigate(`/groups/${group.id}/edit`)}
                  className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleInvite}
                  className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Invite
                </button>
              )}
              <button
                onClick={() => navigate(`/groups/${group.id}/participants`)}
                className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Users className="h-4 w-4 mr-2" />
                Members
              </button>
            </div>
          </div>
        </div>

        {/* Events Section */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="p-3 border-b bg-muted flex items-center justify-between">
            <h2 className="text-sm font-medium">Group Events</h2>
            <Select
              value={eventFilter}
              onValueChange={(value) => setEventFilter(value as 'active' | 'archived')}
            >
              <SelectTrigger className="h-7 w-[100px] text-xs bg-background border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active" className="text-xs">
                  Active
                </SelectItem>
                <SelectItem value="archived" className="text-xs">
                  Archived
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(() => {
            if (eventsLoading) return <EventListSkeleton count={3} />;

            const filteredEvents = (events || []).filter((e) =>
              eventFilter === 'active'
                ? !isEventCompleted(e.datetime, e.end_datetime) || !!e._unsettled
                : isEventCompleted(e.datetime, e.end_datetime) && !e._unsettled
            );

            if (filteredEvents.length === 0) {
              return (
                <div className="p-6 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <h3 className="text-base font-medium mb-2">
                    {eventFilter === 'active' ? 'No Active Events' : 'No Archived Events'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {eventFilter === 'active'
                      ? 'Create your first event for this group'
                      : 'Completed events will appear here'}
                  </p>
                </div>
              );
            }

            return (
              <div className="divide-y">
                {filteredEvents.map((event) => (
                  <div key={event.id} className="relative">
                    <button
                      onClick={() => navigate(`/signup/${event.id}`)}
                      className="w-full p-3 text-left hover:bg-muted transition-colors"
                    >
                      <div className="flex flex-col">
                        <div
                          className={`mb-3 ${isAdmin && isEventDuplicationEnabled ? 'pr-8' : ''}`}
                        >
                          <h3 className="text-sm font-semibold truncate">{event.name}</h3>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          {event.datetime && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatEventDateTime(event.datetime)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3">
                            {event._unsettled && !isAdmin && (
                              <div className="flex items-center gap-1 text-amber-600">
                                <Clock className="h-3 w-3" />
                                <span className="font-medium">Unpaid</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span>{event.participant_count || 0} registered</span>
                            </div>
                            {event.is_private && (
                              <Badge variant="outline" className="text-xs h-5">
                                Private
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                    {isAdmin && isEventDuplicationEnabled && (
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
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Add Event Button - Only visible to admins */}
      {isAdmin && (
        <button
          onClick={() => navigate(`/groups/${group.id}/events/new`)}
          className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg drop-shadow-md flex items-center justify-center font-medium transition-all"
          aria-label="Add Event"
        >
          <Plus className="h-5 w-5" />
        </button>
      )}

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
