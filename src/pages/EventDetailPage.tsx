import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { errorHandler } from '@/lib/errorHandler';
import {
  eventService,
  participantService,
  labelService,
  type Participant as ServiceParticipant,
  type Label as LabelType,
} from '@/services';
import type { CustomField } from '@/types/app.types';
import {
  Users,
  Share2,
  Download,
  Search,
  Edit,
  UserPlus,
  UserCheck,
  UserX,
  ArrowUpDown,
  Zap,
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EventDetailSkeleton } from '@/components/EventDetailSkeleton';

type Participant = ServiceParticipant & {
  notes?: string | null;
  user_id?: string | null;
};

interface EventData {
  id: string;
  name: string;
  description: string | null;
  datetime: string | null;
  location: string | null;
  max_participants: number | null;
  organizer_id: string;
  is_private: boolean | null;
  custom_fields: CustomField[];
}

/**
 * Render the event detail page including event information, participants, signup UI, and related actions.
 *
 * The component loads event, label, and participant data; enforces access controls for private events;
 * and provides interactions for signing up, modifying or withdrawing registrations, claiming spots,
 * labeling participants, exporting participant data, and sharing the signup link.
 *
 * @returns The page's rendered React element
 */
export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [labels, setLabels] = useState<LabelType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [showSignupDrawer, setShowSignupDrawer] = useState(false);
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    responses: {} as Record<string, string>,
  });
  const [submitting, setSubmitting] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [userRegistration, setUserRegistration] = useState<Participant | null>(null);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [isClaimingForOther, setIsClaimingForOther] = useState(false);
  const [withdrawingParticipant, setWithdrawingParticipant] = useState<Participant | null>(null);

  useEffect(() => {
    if (eventId) {
      loadEventData();
    }
  }, [eventId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEventData = async () => {
    if (!eventId) return;

    try {
      // Load event
      const eventData = await eventService.getEventById(eventId);

      // If event is private and user is not authenticated, deny access
      if (eventData.is_private && !user) {
        navigate('/auth/login');
        return;
      }

      // If event is private and user is authenticated, check if they're the organizer
      if (eventData.is_private && user && eventData.organizer_id !== user.id) {
        // Check if user is a participant
        const { data: participantCheck } = await supabase
          .from('participants')
          .select('id')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .single();

        // If not organizer and not participant, deny access
        if (!participantCheck) {
          navigate('/');
          return;
        }
      }

      setEvent({
        ...eventData,
        custom_fields: eventData.custom_fields as CustomField[],
      });

      // Load labels
      const labelsData = await labelService.getLabelsByEventId(eventId);
      setLabels(labelsData);

      // Load participants
      const participantsData = await participantService.getParticipantsByEventId(eventId);

      if (participantsData) {
        setParticipants(participantsData as any); // eslint-disable-line @typescript-eslint/no-explicit-any

        // Check if current user is already registered
        let currentUserRegistration = participantsData.find(
          (p) => (user?.id && p.user_id === user.id) || (user?.email && p.email === user.email)
        );

        // If not found by user_id but found by email, update the participant record to link to user
        if (!currentUserRegistration && user?.email) {
          const emailMatch = participantsData.find((p) => p.email === user.email && !p.user_id);
          if (emailMatch) {
            // Update participant to link to current user
            participantService.updateParticipant(emailMatch.id, { user_id: user.id }).then(() => {
              // Reload data to reflect the update
              loadEventData();
            });
            currentUserRegistration = emailMatch;
          }
        }

        setUserRegistration(currentUserRegistration || null);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    } finally {
      setLoading(false);
    }
  };

  const shareEvent = () => {
    const url = `${window.location.origin}/signup/${eventId}`;
    const shareText = `Sign up for ${event?.name} ${url}`;

    if (navigator.share) {
      navigator.share({
        text: shareText,
      });
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Signup link copied to clipboard!');
    }
  };

  const exportToCSV = () => {
    if (!participants.length) return;

    const headers = ['Name', 'Email', 'Phone', 'Labels', 'Sign Up Date'];
    if (event?.custom_fields) {
      event.custom_fields.forEach((field) => headers.push(field.label));
    }

    const rows = participants.map((p) => {
      const row = [
        p.name,
        p.email || '',
        p.phone || '',
        p.labels?.map((l) => l.name).join('; ') || '',
        new Date(p.created_at).toLocaleDateString(),
      ];
      if (event?.custom_fields) {
        event.custom_fields.forEach((field) => {
          row.push(String(p.responses[field.id || ''] || ''));
        });
      }
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event?.name || 'participants'}.csv`;
    a.click();
  };

  const toggleParticipantLabel = async (participant: Participant, label: LabelType) => {
    const hasLabel = participant.labels?.some((l) => l.id === label.id) || false;

    try {
      if (hasLabel) {
        await participantService.removeLabelFromParticipant(participant.id, label.id);
        errorHandler.success(`Label "${label.name}" removed from ${participant.name}`);
      } else {
        await participantService.addLabelToParticipant(participant.id, label.id);
        errorHandler.success(`Label "${label.name}" added to ${participant.name}`);
      }
      loadEventData();
    } catch (error) {
      errorHandler.handle(error, {
        userId: user?.id,
        action: hasLabel ? 'removeLabelFromParticipant' : 'addLabelToParticipant',
        metadata: {
          participantId: participant.id,
          participantName: participant.name,
          labelId: label.id,
          labelName: label.name,
        },
      });
    }
  };

  const openSignupDrawer = (slotNumber?: number) => {
    // Redirect to login if user is not authenticated
    if (!user) {
      navigate('/auth/login');
      return;
    }

    // Determine if this is for claiming a spot for someone else
    const isClaiming = slotNumber !== undefined;
    setIsClaimingForOther(isClaiming);

    if (isClaiming) {
      // Reset form for claiming a new spot for someone else
      setSignupForm({
        name: '',
        email: '',
        phone: '',
        notes: '',
        responses: {},
      });
    } else if (userRegistration) {
      // Pre-fill form with existing registration data
      setSignupForm({
        name: userRegistration.name || '',
        email: userRegistration.email || '',
        phone: userRegistration.phone || '',
        notes: userRegistration.notes || '',
        responses: Object.entries(userRegistration.responses || {}).reduce(
          (acc, [key, val]) => {
            acc[key] = String(val);
            return acc;
          },
          {} as Record<string, string>
        ),
      });
    } else {
      // Reset form for new registration
      setSignupForm({
        name: '',
        email: '',
        phone: '',
        notes: '',
        responses: {},
      });
    }
    setShowSignupDrawer(true);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!event) return;

    setSubmitting(true);
    setSignupError('');

    try {
      if (userRegistration && !isClaimingForOther) {
        // Update existing registration (only when not claiming for others)
        await participantService.updateParticipant(userRegistration.id, {
          name: signupForm.name,
          email: signupForm.email,
          phone: signupForm.phone,
          notes: signupForm.notes,
          responses: signupForm.responses,
        });
      } else {
        // Create new registration
        if (isClaimingForOther) {
          // Creating a participant for someone else (claimed spot)
          const participantData = {
            event_id: event.id,
            name: signupForm.name, // Could be empty for quick claims
            email: signupForm.email,
            phone: signupForm.phone,
            notes: signupForm.notes,
            responses: signupForm.responses,
            user_id: null, // Will be set by service based on claiming options
            claimed_by_user_id: null, // Will be set by the service
          };
          const claimingOptions = {
            // Don't pass targetSlotNumber - let database assign next available slot
            // targetSlotNumber: claimingSlotNumber || undefined,
            claimingUserId: user?.id,
            claimingUserName: user?.user_metadata?.full_name || user?.email || 'User',
          };

          try {
            await participantService.createParticipant(participantData, claimingOptions);
          } catch (serviceError) {
            console.error('Error in participantService.createParticipant:', serviceError);
            throw serviceError;
          }
        } else {
          // Creating their own registration
          await participantService.createParticipant({
            event_id: event.id,
            name: signupForm.name,
            email: signupForm.email,
            phone: signupForm.phone,
            notes: signupForm.notes,
            responses: signupForm.responses,
            user_id: user?.id || null,
            claimed_by_user_id: null,
          });
        }
      }

      // Reset form and close drawer
      setSignupForm({
        name: '',
        email: '',
        phone: '',
        notes: '',
        responses: {},
      });
      setShowSignupDrawer(false);
      setIsClaimingForOther(false);

      // Reload participants
      loadEventData();
    } catch (err) {
      const error = err as Error;
      setSignupError(
        error.message || 'Failed to ' + (userRegistration ? 'update registration' : 'sign up')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmWithdraw = async () => {
    if (!userRegistration || !user) return;

    setSubmitting(true);
    setSignupError('');

    try {
      await participantService.deleteParticipant(userRegistration.id);

      // Reset form and close drawer
      setSignupForm({
        name: '',
        email: '',
        phone: '',
        notes: '',
        responses: {},
      });
      setShowSignupDrawer(false);
      setShowWithdrawDialog(false);
      setIsClaimingForOther(false);

      // Reload participants
      loadEventData();
    } catch (err) {
      const error = err as Error;
      setSignupError(error.message || 'Failed to withdraw from event');
    } finally {
      setSubmitting(false);
    }
  };

  const quickFillFromProfile = () => {
    if (!user) return;

    setSignupForm((prev) => ({
      ...prev,
      name: user.user_metadata?.full_name || prev.name,
      email: user.email || prev.email,
      phone: user.user_metadata?.phone || prev.phone,
    }));
  };

  const canQuickFill = user && (user.user_metadata?.full_name || user.email);

  // Helper functions for claimed spot detection
  const isClaimedSpot = (participant: Participant) => {
    if (!user) return false;
    if (participant.id === userRegistration?.id) return false; // User's main registration

    // Check if this participant was claimed by the current user
    // Use claimed_by_user_id if available, fallback to name pattern for legacy claimed spots
    if (participant.claimed_by_user_id) {
      return participant.claimed_by_user_id === user.id;
    }

    // Fallback: Check if name matches claim pattern "UserName - #" (for existing claimed spots)
    const userName = user.user_metadata?.full_name || user.email || 'User';
    const claimPattern = new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} - \\d+$`);
    return claimPattern.test(participant.name);
  };

  const getClaimBadgeNumber = (participant: Participant) => {
    if (!isClaimedSpot(participant)) return null;
    const userName = user?.user_metadata?.full_name || user?.email || 'User';
    const match = participant.name.match(
      new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} - (\\d+)$`)
    );
    return match ? match[1] : null;
  };

  const getDisplayName = (participant: Participant) => {
    if (!isClaimedSpot(participant)) return participant.name;
    const userName = user?.user_metadata?.full_name || user?.email || 'User';
    return userName;
  };

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.includes(searchQuery)
  );

  if (loading) {
    return <EventDetailSkeleton />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Event not found</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${user ? 'pb-32' : 'pb-20'}`}>
      <TopNav title={event.name} showBackButton={!!user} backPath="/events" sticky />

      <div className="p-3 space-y-3">
        {/* Event Info */}
        {(event.description || event.datetime || event.location || event.max_participants) && (
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="p-3 space-y-2">
              {/* Top row: Date and Registration Deadline */}
              {event.datetime && (
                <div className="grid grid-cols-2 gap-3">
                  {event.datetime && (
                    <div className="text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">Date</div>
                      <div>
                        {new Date(event.datetime).toLocaleString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">Registration Deadline</div>
                    <div>None</div>
                  </div>
                </div>
              )}

              {/* Second row: Location */}
              {event.location && (
                <div className="text-sm text-muted-foreground">
                  <div className="font-medium text-foreground">Location</div>
                  <div>{event.location}</div>
                </div>
              )}

              {/* Horizontal divider */}
              {event.location && event.description && (
                <div className="border-t border-border"></div>
              )}

              {/* Description */}
              {event.description && (
                <div className="text-sm text-foreground">
                  <div className="font-medium text-foreground mb-1">Description</div>
                  <p className="leading-relaxed">{event.description}</p>
                </div>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div className="border-t bg-muted">
              <div className="flex divide-x divide-border">
                <button
                  onClick={() => navigate(`/events/${eventId}/edit`)}
                  className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
                <button
                  onClick={shareEvent}
                  className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Participants List */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">Participants</h2>
              <p className="text-xs text-muted-foreground">
                {(() => {
                  // Count unique users (by user_id and email for non-users)
                  const uniqueUsers = new Set();
                  participants.forEach((p) => {
                    if (p.user_id) {
                      uniqueUsers.add(p.user_id);
                    } else if (p.email) {
                      uniqueUsers.add(p.email);
                    } else {
                      // For participants without user_id or email, count each as unique
                      uniqueUsers.add(p.id);
                    }
                  });
                  const uniqueUserCount = uniqueUsers.size;

                  if (event.max_participants) {
                    return `${participants.length}/${event.max_participants} participants, ${uniqueUserCount} ${uniqueUserCount === 1 ? 'person' : 'persons'} signed up`;
                  } else {
                    return `${uniqueUserCount} ${uniqueUserCount === 1 ? 'person' : 'persons'} signed up`;
                  }
                })()}
              </p>
            </div>
            <div className="flex border border-border rounded">
              <Button
                size="sm"
                variant="ghost"
                className={`h-7 px-2 rounded-r-none border-0 border-r border-border ${
                  showSearchBar ? 'bg-muted' : ''
                }`}
                onClick={() => setShowSearchBar(!showSearchBar)}
                disabled={participants.length === 0}
              >
                <Search className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 rounded-l-none border-0"
                onClick={() => {}}
                disabled={participants.length === 0}
              >
                <ArrowUpDown className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          {showSearchBar && (
            <div className="p-3 border-b bg-muted">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search participants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
          )}

          <div className="divide-y">
            {(() => {
              const maxSlots = event.max_participants || filteredParticipants.length;
              const slots = [];

              // Add existing participants to slots (already ordered by slot_number)
              for (let i = 0; i < Math.min(filteredParticipants.length, maxSlots); i++) {
                const participant = filteredParticipants[i];
                const isOwnClaimedSpot = isClaimedSpot(participant);
                const claimNumber = getClaimBadgeNumber(participant);
                const displayName = getDisplayName(participant);

                slots.push(
                  <div key={participant.id} className="p-3 hover:bg-muted transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="text-xs text-muted-foreground font-mono flex-shrink-0 mt-1">
                        {participant.slot_number}.
                      </div>
                      <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-medium text-white">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              onClick={() => setSelectedParticipant(participant)}
                              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors truncate text-left min-w-0 max-w-full"
                            >
                              {displayName}
                            </button>
                            {isOwnClaimedSpot && claimNumber && (
                              <Badge variant="outline" className="text-xs h-5 px-1">
                                +{claimNumber}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {participant.user_id === event.organizer_id &&
                              participant.slot_number === 1 && (
                                <Badge variant="outline" className="text-xs h-5 px-2">
                                  Organizer
                                </Badge>
                              )}
                            {isOwnClaimedSpot && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWithdrawingParticipant(participant);
                                }}
                                className="text-xs h-6 px-2 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                              >
                                <UserX className="h-3 w-3 mr-1" />
                                Withdraw
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Signed up{' '}
                          {(() => {
                            const now = new Date();
                            const signupTime = new Date(participant.created_at);
                            const diffMs = now.getTime() - signupTime.getTime();
                            const diffMins = Math.floor(diffMs / (1000 * 60));
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                            if (diffMins < 60) {
                              return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
                            } else if (diffHours < 24) {
                              return `${diffHours}h ago`;
                            } else if (diffDays < 7) {
                              return `${diffDays}d ago`;
                            } else {
                              return `on ${signupTime.toLocaleDateString()}`;
                            }
                          })()}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {participant.labels?.map((label) => (
                            <Badge key={label.id} variant="outline" className="text-xs h-5">
                              {label.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Add empty slots if we have max_participants set
              if (event.max_participants && filteredParticipants.length < event.max_participants) {
                // Find the highest slot number used
                const maxUsedSlot =
                  filteredParticipants.length > 0
                    ? Math.max(...filteredParticipants.map((p) => p.slot_number))
                    : 0;

                // Add empty slots for remaining capacity
                for (let slotNum = maxUsedSlot + 1; slotNum <= event.max_participants; slotNum++) {
                  const isFirstEmptySlot = slotNum === maxUsedSlot + 1;
                  const canClaimSpot = user && userRegistration && isFirstEmptySlot;

                  slots.push(
                    <div key={`empty-${slotNum}`} className="p-3 border-dashed border-border">
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground font-mono flex-shrink-0">
                          {slotNum}.
                        </div>
                        <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-muted-foreground">?</span>
                        </div>
                        <div className="flex-1 flex items-center justify-between">
                          <div className="text-sm text-muted-foreground italic">Available slot</div>
                          {canClaimSpot && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openSignupDrawer(slotNum)}
                              className="text-xs h-6 px-2"
                            >
                              <UserPlus className="h-3 w-3 mr-1" />
                              Claim Spot
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
              }

              if (slots.length === 0) {
                return (
                  <div className="p-6 text-center">
                    <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? 'No participants found' : 'No participants yet'}
                    </p>
                  </div>
                );
              }

              return slots;
            })()}
          </div>
        </div>
      </div>

      {/* Join Event Button */}
      <div className={`fixed left-0 right-0 z-40 px-4 pb-2 ${user ? 'bottom-16' : 'bottom-4'}`}>
        <Button
          onClick={() => openSignupDrawer()}
          className={`w-full text-white shadow-lg ${
            userRegistration ? 'bg-primary hover:bg-primary/90' : 'bg-primary hover:bg-primary/90'
          }`}
          size="default"
        >
          {userRegistration ? (
            <>
              <UserCheck className="h-5 w-5 mr-2" />
              Modify Registration
            </>
          ) : (
            <>
              <UserPlus className="h-5 w-5 mr-2" />
              Join Event
            </>
          )}
        </Button>
      </div>

      {/* Signup Drawer */}
      <Drawer
        open={showSignupDrawer}
        onOpenChange={(open) => {
          if (!open) {
            setIsClaimingForOther(false);
          }
          setShowSignupDrawer(open);
        }}
      >
        <DrawerContent className="max-h-[90vh] p-0">
          <div className="border-b p-3">
            <h2 className="text-lg font-semibold">
              {isClaimingForOther
                ? 'Claim Spot'
                : userRegistration
                  ? 'Modify Registration'
                  : 'Join Event'}
            </h2>
            {isClaimingForOther && (
              <p className="text-sm text-muted-foreground mt-1">
                Leave name empty to claim under your name
              </p>
            )}
          </div>
          <div className="overflow-y-auto flex-1 px-3">
            <form id="signup-form" onSubmit={handleSignup} className="space-y-2 pb-3">
              <Tabs defaultValue="registration" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="registration">Registration</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="registration" className="space-y-2 mt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-name" className="text-xs">
                      Name {!isClaimingForOther && '*'}
                    </Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={signupForm.name}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      required={!isClaimingForOther}
                      autoComplete="off"
                      className="h-9 text-sm"
                      placeholder={isClaimingForOther ? 'Leave empty to claim under your name' : ''}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email" className="text-xs">
                      Email (optional)
                    </Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={signupForm.email}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                      autoComplete="off"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-phone" className="text-xs">
                      Phone (optional)
                    </Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      value={signupForm.phone}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      autoComplete="off"
                      className="h-9 text-sm"
                    />
                  </div>

                  {event?.custom_fields && event.custom_fields.length > 0 && (
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium mb-2">Additional Information</h3>
                      {event.custom_fields.map((field) => (
                        <div key={field.id} className="space-y-1.5 mb-2">
                          <Label htmlFor={`signup-${field.id}`} className="text-xs">
                            {field.label} {field.required && '*'}
                          </Label>
                          {field.type === 'select' && field.options ? (
                            <Select
                              value={signupForm.responses[field.id || ''] || ''}
                              onValueChange={(value) =>
                                setSignupForm((prev) => ({
                                  ...prev,
                                  responses: {
                                    ...prev.responses,
                                    [field.id || '']: value,
                                  },
                                }))
                              }
                            >
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options.map((option: string) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={`signup-${field.id}`}
                              type={field.type}
                              value={signupForm.responses[field.id || ''] || ''}
                              onChange={(e) =>
                                setSignupForm((prev) => ({
                                  ...prev,
                                  responses: {
                                    ...prev.responses,
                                    [field.id || '']: e.target.value,
                                  },
                                }))
                              }
                              required={field.required}
                              autoComplete="off"
                              className="h-9 text-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="space-y-2 mt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-notes" className="text-xs">
                      Notes (optional)
                    </Label>
                    <Textarea
                      id="signup-notes"
                      value={signupForm.notes}
                      onChange={(e) =>
                        setSignupForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      placeholder="Any additional notes or comments..."
                      className="min-h-[100px] text-sm"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {signupError && (
                <div className="text-xs text-destructive-foreground bg-destructive/10 p-1.5 rounded">
                  {signupError}
                </div>
              )}
            </form>
          </div>
          <div className="border-t border-border"></div>
          <div className="p-3">
            <div className="flex gap-1.5 w-full">
              {userRegistration && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1 py-1"
                  onClick={() => setShowWithdrawDialog(true)}
                  disabled={submitting}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Withdraw
                </Button>
              )}
              {!userRegistration && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 py-1"
                  onClick={quickFillFromProfile}
                  disabled={!canQuickFill || submitting}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Quick Fill
                </Button>
              )}
              <Button
                type="submit"
                form="signup-form"
                size="sm"
                className="flex-1 bg-primary hover:bg-primary/90 text-white py-1"
                disabled={submitting}
              >
                {submitting
                  ? isClaimingForOther
                    ? 'Claiming...'
                    : userRegistration
                      ? 'Updating...'
                      : 'Joining...'
                  : isClaimingForOther
                    ? 'Claim Spot'
                    : userRegistration
                      ? 'Update Registration'
                      : 'Join Event'}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Participant Details Sheet */}
      <Sheet
        open={!!selectedParticipant}
        onOpenChange={(open) => !open && setSelectedParticipant(null)}
      >
        <SheetContent side="bottom" className="h-[80vh]">
          {selectedParticipant && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedParticipant.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-3 space-y-2">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-medium">Contact Information</h3>
                  <div className="text-sm space-y-0.5">
                    <div>Email: {selectedParticipant.email || 'Not provided'}</div>
                    <div>Phone: {selectedParticipant.phone || 'Not provided'}</div>
                    <div>
                      Registered: {new Date(selectedParticipant.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {event.custom_fields && event.custom_fields.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-medium">Additional Information</h3>
                    <div className="text-sm space-y-0.5">
                      {event.custom_fields.map((field) => (
                        <div key={field.id}>
                          {field.label}:{' '}
                          {selectedParticipant.responses[field.id || ''] || 'Not provided'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <h3 className="text-sm font-medium">Labels</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {labels.map((label) => {
                      const hasLabel =
                        selectedParticipant.labels?.some((l) => l.id === label.id) || false;
                      return (
                        <button
                          key={label.id}
                          onClick={() => toggleParticipantLabel(selectedParticipant, label)}
                          className={`px-2.5 py-0.5 text-xs rounded-full border transition-colors ${
                            hasLabel
                              ? 'bg-primary text-white border-primary'
                              : 'bg-card text-muted-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {label.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw from Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw from this event? This action cannot be undone and
              you'll need to register again if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-1.5 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowWithdrawDialog(false)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmWithdraw}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              {submitting ? 'Withdrawing...' : 'Withdraw'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual Participant Withdrawal Dialog */}
      <Dialog
        open={!!withdrawingParticipant}
        onOpenChange={(open) => !open && setWithdrawingParticipant(null)}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Participant</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              {withdrawingParticipant ? getDisplayName(withdrawingParticipant) : ''} from this
              event? This will free up their spot for others to claim.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-1.5 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setWithdrawingParticipant(null)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!withdrawingParticipant) return;

                setSubmitting(true);
                setSignupError('');

                try {
                  await participantService.deleteParticipant(withdrawingParticipant.id);
                  setWithdrawingParticipant(null);
                  loadEventData();
                } catch (err) {
                  const error = err as Error;
                  setSignupError(error.message || 'Failed to remove participant');
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              {submitting ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
