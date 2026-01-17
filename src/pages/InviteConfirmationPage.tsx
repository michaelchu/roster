import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { eventService, participantService, groupService } from '@/services';
import type { Event } from '@/services/eventService';
import type { Group } from '@/services/groupService';
import { EventDetailSkeleton } from '@/components/EventDetailSkeleton';
import { formatEventDateTime } from '@/lib/utils';
import { Calendar, Users, UserPlus, CheckCircle, ArrowRight } from 'lucide-react';

type InviteType = 'event' | 'group';

export function InviteConfirmationPage() {
  const { type, id } = useParams<{ type: InviteType; id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<Event | null>(null);
  const [groupData, setGroupData] = useState<Group | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

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

        // Check if user is already a participant
        if (user) {
          const participant = await participantService.getParticipantByUserAndEvent(user.id, id);
          setIsMember(!!participant);
        }
      } else if (type === 'group') {
        const group = await groupService.getGroupById(id);
        setGroupData(group);

        // Check if user is already a group member
        if (user) {
          const isGroupMember = await groupService.checkUserGroupMembership(user.id, id);
          setIsMember(isGroupMember);
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

    // Determine the target page after login
    const targetUrl = type === 'event' ? `/signup/${id}` : `/groups/${id}`;

    // Navigate to login with returnUrl pointing to the event/group page
    navigate(`/auth/login?returnUrl=${encodeURIComponent(targetUrl)}`);
  };

  const handleRSVPAsGuest = () => {
    if (!eventData) return;
    // Navigate directly to the event signup page for guest RSVP
    navigate(`/signup/${eventData.id}`);
  };

  const handleViewEvent = () => {
    if (!eventData) return;
    navigate(`/signup/${eventData.id}`);
  };

  const handleViewGroup = () => {
    if (!groupData) return;
    navigate(`/groups/${groupData.id}`);
  };

  const handleJoinGroup = async () => {
    if (!groupData || !user) return;

    setJoining(true);
    try {
      await groupService.addUserToGroup(groupData.id, user.id);
      setIsMember(true);
      // Optionally show success message
    } catch (err) {
      console.error('Error joining group:', err);
      setError(err instanceof Error ? err.message : 'Failed to join group');
    } finally {
      setJoining(false);
    }
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

          {/* Action Card */}
          <div className="bg-card rounded-lg border p-4">
            {!user ? (
              <div className="text-center space-y-3">
                {eventData.group_id ? (
                  // Group events require authentication
                  <>
                    <p className="text-sm text-muted-foreground">
                      This event is part of a group. Please sign in to RSVP.
                    </p>
                    <Button onClick={handleSignInClick} className="w-full">
                      Sign in to RSVP
                    </Button>
                  </>
                ) : (
                  // Standalone events allow guest RSVP
                  <>
                    <p className="text-sm text-muted-foreground">
                      RSVP as a guest or sign in to manage your registration
                    </p>
                    <div className="space-y-2">
                      <Button onClick={handleRSVPAsGuest} className="w-full">
                        <UserPlus className="h-4 w-4 mr-2" />
                        RSVP as Guest
                      </Button>
                      <Button onClick={handleSignInClick} variant="outline" className="w-full">
                        Sign in to manage RSVP
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2 border-t">
                      💡 Create an account to easily modify or cancel your RSVP later
                    </p>
                  </>
                )}
              </div>
            ) : isMember ? (
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">You're already registered!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You've already joined this event. Click below to view details or modify your
                  registration.
                </p>
                <Button onClick={handleViewEvent} variant="outline" className="w-full">
                  View Event Details
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Join this event to secure your spot and receive updates
                </p>
                <Button onClick={handleRSVPAsGuest} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  RSVP to Event
                </Button>
              </div>
            )}
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
                {groupData.is_private && (
                  <Badge variant="secondary" className="text-xs">
                    Private
                  </Badge>
                )}
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

          {/* Action Card */}
          <div className="bg-card rounded-lg border p-4">
            {!user ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sign in to view this group and join its events
                </p>
                <Button onClick={handleSignInClick} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Sign in to join
                </Button>
              </div>
            ) : isMember ? (
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">You're already a member!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You're part of this group. Click below to view events and manage your
                  participation.
                </p>
                <Button onClick={handleViewGroup} variant="outline" className="w-full">
                  View Group Details
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  Join this group to stay updated on events and connect with other members
                </p>
                <Button onClick={handleJoinGroup} disabled={joining} className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  {joining ? 'Joining...' : 'Join Group'}
                </Button>
                <Button onClick={handleViewGroup} variant="outline" className="w-full">
                  View Group Details
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
