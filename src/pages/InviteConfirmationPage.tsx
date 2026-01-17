import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { eventService, groupService } from '@/services';
import type { Event } from '@/services/eventService';
import type { Group } from '@/services/groupService';
import { EventDetailSkeleton } from '@/components/EventDetailSkeleton';
import { formatEventDateTime } from '@/lib/utils';
import { Calendar, Users, UserPlus } from 'lucide-react';

type InviteType = 'event' | 'group';

export function InviteConfirmationPage() {
  const { type, id } = useParams<{ type: InviteType; id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<Event | null>(null);
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !id) {
      setError('Invalid invite link');
      setLoading(false);
      return;
    }

    if (type !== 'event' && type !== 'group') {
      setError('Invalid invite type');
      setLoading(false);
      return;
    }

    loadInviteData();
  }, [type, id, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInviteData = async () => {
    if (!type || !id) return;

    try {
      setLoading(true);
      setError(null);

      if (type === 'event') {
        const event = await eventService.getEventById(id);
        setEventData(event);

        // Auto-redirect logged-in users to the event detail page
        if (user) {
          navigate(`/signup/${id}`);
          return;
        }
      } else if (type === 'group') {
        const group = await groupService.getGroupById(id);
        setGroupData(group);

        // Auto-join and redirect logged-in users to the group page
        if (user) {
          const isGroupMember = await groupService.checkUserGroupMembership(user.id, id);
          if (!isGroupMember) {
            // Auto-join the group when user lands on invite page after signing in
            try {
              await groupService.addUserToGroup(id, user.id);
            } catch (joinErr) {
              console.error('Error auto-joining group:', joinErr);
              // Still redirect, they can try manual join from group page
            }
          }
          navigate(`/groups/${id}`);
          return;
        }
      }
    } catch (err) {
      console.error('Error loading invite data:', err);
      const errorMessage =
        err instanceof Error ? err.message : `${type === 'event' ? 'Event' : 'Group'} not found`;
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInClick = () => {
    if (!type || !id) return;

    // Return to invite page after login so user can complete the join action
    const targetUrl = `/invite/${type}/${id}`;

    // Navigate to login with returnUrl pointing back to invite page
    navigate(`/auth/login?returnUrl=${encodeURIComponent(targetUrl)}`);
  };

  if (loading || authLoading) {
    return <EventDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-destructive text-sm mb-4">{error}</div>
          <Button onClick={() => navigate('/')} variant="outline">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  // Event Invite UI
  if (type === 'event' && eventData) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-card border-b">
          <div className="flex items-center justify-center px-4 py-3">
            <h1 className="text-lg font-semibold">Event Invitation</h1>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Event Info Card */}
          <div className="bg-card rounded-lg border overflow-hidden">
            <div>
              {/* Event Name */}
              <div className="p-3 border-b border-border">
                <h2 className="text-lg font-semibold">{eventData.name}</h2>
                {eventData.is_private && (
                  <Badge variant="secondary" className="text-xs mt-1">
                    Private
                  </Badge>
                )}
              </div>

              {/* Top row: Start and End times */}
              {(eventData.datetime || eventData.end_datetime) && (
                <div className="grid grid-cols-2 divide-x divide-border">
                  <div className="text-sm text-muted-foreground p-3">
                    <div className="font-medium text-foreground">Start</div>
                    <div>
                      {eventData.datetime ? formatEventDateTime(eventData.datetime) : 'Not set'}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground p-3">
                    <div className="font-medium text-foreground">End</div>
                    <div>
                      {eventData.end_datetime
                        ? formatEventDateTime(eventData.end_datetime)
                        : 'Not set'}
                    </div>
                  </div>
                </div>
              )}

              {/* Registration Deadline section */}
              {(eventData.datetime || eventData.end_datetime) && (
                <>
                  <div className="border-t border-border"></div>
                  <div className="text-sm text-muted-foreground p-3">
                    <div className="font-medium text-foreground">Registration Deadline</div>
                    <div>None</div>
                  </div>
                </>
              )}

              {/* Horizontal divider between registration deadline and location */}
              {(eventData.datetime || eventData.end_datetime) && eventData.location && (
                <div className="border-t border-border"></div>
              )}

              {/* Location */}
              {eventData.location && (
                <div className="text-sm text-muted-foreground p-3">
                  <div className="font-medium text-foreground">Location</div>
                  <div>{eventData.location}</div>
                </div>
              )}

              {/* Horizontal divider */}
              {eventData.location && eventData.max_participants && (
                <div className="border-t border-border"></div>
              )}

              {/* Capacity */}
              {eventData.max_participants && (
                <div className="text-sm text-muted-foreground p-3">
                  <div className="font-medium text-foreground">Capacity</div>
                  <div>
                    {eventData.participant_count || 0} / {eventData.max_participants} participants
                  </div>
                </div>
              )}

              {/* Horizontal divider */}
              {(eventData.location || eventData.max_participants) && eventData.description && (
                <div className="border-t border-border"></div>
              )}

              {/* Description */}
              {eventData.description && (
                <div className="text-sm text-foreground p-3">
                  <div className="font-medium text-foreground mb-1">Description</div>
                  <p className="leading-relaxed">{eventData.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Card - only shown for unauthenticated users (authenticated users are auto-redirected) */}
          <div className="bg-card rounded-lg border p-4">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Sign in to RSVP for this event</p>
              <Button onClick={handleSignInClick} className="w-full">
                Sign in to RSVP
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Group Invite UI
  if (type === 'group' && groupData) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="bg-card border-b">
          <div className="flex items-center justify-center px-4 py-3">
            <h1 className="text-lg font-semibold">Group Invitation</h1>
          </div>
        </div>

        <div className="p-3 space-y-3">
          {/* Group Info Card */}
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="p-4 space-y-3">
              <div>
                <h2 className="text-lg font-semibold mb-1">{groupData.name}</h2>
              </div>

              {groupData.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {groupData.description}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{groupData.event_count || 0} events</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{groupData.participant_count || 0} members</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Card - only shown for unauthenticated users (authenticated users are auto-redirected) */}
          <div className="bg-card rounded-lg border p-4">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to view this group and join its events
              </p>
              <Button onClick={handleSignInClick} className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Sign in to join
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
