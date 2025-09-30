import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Users, Plus, UsersRound, Share2, Edit } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { groupService, type Group } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { useLoadingState } from '@/hooks/useLoadingState';
import { EventListSkeleton } from '@/components/LoadingStates';
import type { Tables } from '@/types/app.types';
import { formatEventDateTime } from '@/lib/utils';

interface GroupEvent extends Tables<'events'> {
  participant_count?: number;
}

export function GroupDetailPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [memberCount, setMemberCount] = useState<number>(0);
  const {
    isLoading: eventsLoading,
    data: events,
    execute: loadEvents,
  } = useLoadingState<GroupEvent[]>([]);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;

    try {
      setGroupLoading(true);
      const groupData = await groupService.getGroupById(groupId);
      setGroup(groupData);

      // Load member count
      const members = await groupService.getGroupParticipants(groupId);
      setMemberCount(members.length);
    } catch (error) {
      console.error('Error loading group:', error);
      errorHandler.handle(error);
      navigate('/groups');
    } finally {
      setGroupLoading(false);
    }
  }, [groupId, navigate]);

  const loadEventsCallback = useCallback(async () => {
    if (!groupId) return [];
    return await groupService.getGroupEvents(groupId);
  }, [groupId]);

  const handleInvite = useCallback(async () => {
    if (!group) return;

    // Stub invite link - in the future this would generate a proper invite token
    const inviteLink = `${window.location.origin}/groups/join/${group.id}?invite=stub-token-${Date.now()}`;

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

  useEffect(() => {
    if (user) {
      loadGroup();
      loadEvents(loadEventsCallback);
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
      <TopNav title="" showBackButton backPath="/groups" />

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
              {group.is_private && (
                <Badge variant="secondary" className="text-xs">
                  Private
                </Badge>
              )}
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
              <button
                onClick={() => navigate(`/groups/${group.id}/edit`)}
                className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
              <button
                onClick={handleInvite}
                className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Invite
              </button>
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
          <div className="p-3 border-b">
            <h2 className="text-sm font-medium">Group Events</h2>
          </div>

          {eventsLoading ? (
            <EventListSkeleton count={3} />
          ) : !events || events.length === 0 ? (
            <div className="p-6 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-base font-medium mb-2">No Events Yet</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Create your first event for this group
              </p>
              <Button size="sm" onClick={() => navigate(`/events/new?group=${group.id}`)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Event
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => navigate(`/signup/${event.id}`)}
                  className="w-full p-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="flex flex-col">
                    <div className="mb-3">
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Event Button above navbar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
        <Button
          onClick={() => navigate(`/events/new?group=${group.id}`)}
          className="w-full text-white shadow-lg"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Event
        </Button>
      </div>
    </div>
  );
}
