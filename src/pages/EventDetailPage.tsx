import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { errorHandler } from '@/lib/errorHandler';
import {
  eventService,
  participantService,
  labelService,
  type Participant as ServiceParticipant,
  type Label as LabelType,
} from '@/services';
import type { CustomField } from '@/types/app.types';
import { Users, Share2, Download, Search, Edit, UserPlus, UserCheck, UserX } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { EventActivityTimeline } from '@/components/EventActivityTimeline';
import { formatEventDateTime, isEventCompleted } from '@/lib/utils';
import { EventDetailSkeleton } from '@/components/EventDetailSkeleton';
import { ParticipantListItem, EmptySlot } from '@/components/ParticipantListItem';
import { ParticipantDetailsSheet } from '@/components/ParticipantDetailsSheet';
import { SignupFormDrawer } from '@/components/SignupFormDrawer';

type Participant = ServiceParticipant & {
  notes?: string | null;
  user_id?: string | null;
};

interface EventData {
  id: string;
  name: string;
  description: string | null;
  datetime: string | null;
  end_datetime: string | null;
  location: string | null;
  max_participants: number | null;
  organizer_id: string;
  is_paid: boolean;
  is_private: boolean | null;
  custom_fields: CustomField[];
  group_id: string | null;
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
  const location = useLocation();
  const { user } = useAuth();
  const showRegistrationForm = useFeatureFlag('registration_form');
  const showGuestRegistration = useFeatureFlag('guest_registration');
  const showCsvExport = useFeatureFlag('csv_export');

  // Determine if navbar is hidden (matching App.tsx logic)
  const isNavbarHidden =
    location.pathname.startsWith('/auth') || (location.pathname.startsWith('/signup') && !user);
  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [labels, setLabels] = useState<LabelType[]>([]);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(false);
  const errorHandledRef = useRef(false);
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
  const [userRegistration, setUserRegistration] = useState<Participant | null>(null);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [isClaimingForOther, setIsClaimingForOther] = useState(false);
  const [withdrawingParticipant, setWithdrawingParticipant] = useState<Participant | null>(null);
  const [paymentSummary, setPaymentSummary] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    waived: 0,
  });

  // Check if current user is the organizer
  const isOrganizer = event?.organizer_id === user?.id;

  // Archived (completed) events are always treated as paid for payment tracking
  const isArchived = event ? isEventCompleted(event.datetime, event.end_datetime) : false;
  const effectiveIsPaid = isArchived || (event?.is_paid ?? true);

  // Check if event is at full capacity
  const isEventFull =
    event?.max_participants !== null &&
    event?.max_participants !== undefined &&
    participants.length >= event.max_participants;

  useEffect(() => {
    // Reset refs on mount/remount
    loadingRef.current = false;
    errorHandledRef.current = false;

    if (eventId) {
      loadEventData();
    }

    return () => {
      // Prevent duplicate error handling on unmount
      loadingRef.current = true;
    };
  }, [eventId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEventData = async () => {
    if (!eventId || loadingRef.current) return;

    try {
      loadingRef.current = true;
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
        const currentUserRegistration = participantsData.find(
          (p) => user?.id && p.user_id === user.id
        );

        setUserRegistration(currentUserRegistration || null);

        // Load payment summary if user is organizer and event is paid (or archived)
        const archived = isEventCompleted(eventData.datetime, eventData.end_datetime);
        if (
          user &&
          eventData.organizer_id === user.id &&
          (eventData.is_paid || archived) &&
          participantsData.length > 0
        ) {
          const summary = await participantService.getPaymentSummary(eventId);
          setPaymentSummary(summary);
        }
      }
    } catch (error) {
      // Prevent duplicate error toasts
      if (!errorHandledRef.current) {
        errorHandledRef.current = true;
        errorHandler.handle(error, { userId: user?.id, action: 'load event' });
        navigate('/events');
      }
      setLoading(false);
      return;
    }
    setLoading(false);
    loadingRef.current = false;
  };

  const shareEvent = () => {
    const url = `${window.location.origin}/invite/event/${eventId}`;
    const shareText = `Join ${event?.name} ${url}`;

    if (navigator.share) {
      navigator.share({
        text: shareText,
      });
    } else {
      navigator.clipboard.writeText(shareText);
      errorHandler.success('Invite link copied to clipboard!');
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

  const togglePaymentStatus = async (participant: Participant) => {
    if (!isOrganizer) return;

    try {
      const newStatus = participant.payment_status === 'paid' ? 'pending' : 'paid';
      await participantService.updatePaymentStatus(participant.id, newStatus);
      errorHandler.success(
        `Payment marked as ${newStatus === 'paid' ? 'paid' : 'pending'} for ${participant.name}`
      );
      setSelectedParticipant(null); // Close the sheet
      loadEventData();
    } catch (error) {
      errorHandler.handle(error, {
        userId: user?.id,
        action: 'updatePaymentStatus',
        metadata: {
          participantId: participant.id,
          participantName: participant.name,
        },
      });
    }
  };

  const openSignupDrawer = (slotNumber?: number) => {
    // Determine if this is for claiming a spot for someone else
    const isClaiming = slotNumber !== undefined;

    // Require authentication for:
    // 1. Claiming spots for others
    // 2. Events that belong to a group
    if (!user && (isClaiming || event?.group_id)) {
      navigate('/auth/login');
      return;
    }

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
      // Prepopulate name with user's full_name if available
      setSignupForm({
        name: user?.user_metadata?.full_name || '',
        email: user?.email || '',
        phone: user?.user_metadata?.phone || '',
        notes: '',
        responses: {},
      });
    }
    setShowSignupDrawer(true);
  };

  // Direct join without form (when registration_form flag is disabled)
  const handleDirectJoin = async () => {
    if (!event || !user) {
      navigate('/auth/login');
      return;
    }

    setSubmitting(true);

    try {
      await participantService.createParticipant({
        event_id: event.id,
        name: user.user_metadata?.full_name || user.email || 'User',
        email: user.email || null,
        phone: user.user_metadata?.phone || null,
        notes: null,
        responses: {},
        user_id: user.id,
        claimed_by_user_id: null,
        payment_status: 'pending' as const,
        payment_marked_at: null,
        payment_notes: null,
      });

      loadEventData();
    } catch (err) {
      const error = err as Error;
      errorHandler.handle(error, {
        userId: user?.id,
        action: 'directJoinEvent',
        metadata: { eventId: event.id },
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!event) return;

    setSubmitting(true);

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
            payment_status: 'pending' as const,
            payment_marked_at: null,
            payment_notes: null,
          };
          const claimingOptions = {
            // Don't pass targetSlotNumber - let database assign next available slot
            // targetSlotNumber: claimingSlotNumber || undefined,
            claimingUserId: user?.id,
            claimingUserName: user?.user_metadata?.full_name || user?.email || 'User',
            claimingUserEmail: user?.email || undefined,
          };

          await participantService.createParticipant(participantData, claimingOptions);
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
            payment_status: 'pending' as const,
            payment_marked_at: null,
            payment_notes: null,
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
      const errorMessage = error.message || '';

      // Check if this is a capacity error (event filled up while user was signing up)
      if (errorMessage.includes('full capacity')) {
        setShowSignupDrawer(false);
        // Refresh to show updated participant count and "Event Full" state
        loadEventData();
        // Show toast after drawer closes so user sees it
        errorHandler.info('Sorry, this event just filled up! The last spot was taken.');
      } else {
        errorHandler.handle(err, {
          userId: user?.id,
          action: userRegistration ? 'update registration' : 'sign up',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmWithdraw = async () => {
    if (!userRegistration || !user) return;

    setSubmitting(true);

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
      errorHandler.handle(err, { userId: user?.id, action: 'withdraw from event' });
    } finally {
      setSubmitting(false);
    }
  };

  const quickFillFromProfile = () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    setSignupForm((prev) => ({
      ...prev,
      name: user.user_metadata?.full_name || prev.name,
      email: user.email || prev.email,
      phone: user.user_metadata?.phone || prev.phone,
    }));
  };

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
    // For claimed spots, show the current user's name
    if (isClaimedSpot(participant)) {
      return user?.user_metadata?.full_name || user?.email || 'User';
    }
    // For linked users, prefer auth_full_name (current) over stored name (stale)
    if (participant.user_id && participant.auth_full_name) {
      return participant.auth_full_name;
    }
    return participant.name;
  };

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.auth_full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.includes(searchQuery)
  );

  if (loading) {
    return <EventDetailSkeleton />;
  }

  if (!event) {
    return <EventDetailSkeleton />;
  }

  return (
    <div className={`min-h-screen bg-background ${user ? 'pb-32' : 'pb-20'}`}>
      <TopNav sticky />

      <div className="p-3 space-y-3">
        {/* Event Info */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div>
            {/* Event Name */}
            <div className="text-lg font-semibold p-3 border-b border-border">{event.name}</div>

            {/* Top row: Start and End times */}
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="text-xs text-muted-foreground p-3">
                <div className="font-medium text-foreground text-sm">Start</div>
                <div>{event.datetime ? formatEventDateTime(event.datetime) : 'TBD'}</div>
              </div>
              <div className="text-xs text-muted-foreground p-3">
                <div className="font-medium text-foreground text-sm">End</div>
                <div>{event.end_datetime ? formatEventDateTime(event.end_datetime) : 'TBD'}</div>
              </div>
            </div>

            {/* Horizontal divider between datetime and location */}
            <div className="border-t border-border"></div>

            {/* Location */}
            <div className="text-sm text-muted-foreground p-3">
              <div className="font-medium text-foreground">Location</div>
              <div>{event.location || 'TBD'}</div>
            </div>

            {/* Horizontal divider */}
            {event.description && <div className="border-t border-border"></div>}

            {/* Description */}
            {event.description && (
              <div className="text-sm text-foreground p-3">
                <p className="leading-relaxed">{event.description}</p>
              </div>
            )}
          </div>

          {/* Action Buttons Footer */}
          <div className="border-t bg-muted">
            <div className="flex divide-x divide-border">
              {isOrganizer && (
                <button
                  onClick={() => navigate(`/signup/${eventId}/edit`)}
                  className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
              )}
              <button
                onClick={shareEvent}
                className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </button>
              {isOrganizer && showCsvExport && (
                <button
                  onClick={exportToCSV}
                  className="flex-1 flex items-center justify-center py-2 px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Payment Summary (Organizer Only, Paid Events Only) */}
        {isOrganizer && participants.length > 0 && effectiveIsPaid && (
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted">
              <h3 className="text-sm font-medium">Payment Status</h3>
            </div>
            <div className="grid grid-cols-3 divide-x">
              <div className="text-center py-2">
                <div className="text-xl font-bold text-green-600">{paymentSummary.paid}</div>
                <div className="text-xs text-muted-foreground">Paid</div>
              </div>
              <div className="text-center py-2">
                <div className="text-xl font-bold text-gray-600">{paymentSummary.pending}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              {paymentSummary.waived > 0 && (
                <div className="text-center py-2">
                  <div className="text-xl font-bold text-blue-600">{paymentSummary.waived}</div>
                  <div className="text-xs text-muted-foreground">Waived</div>
                </div>
              )}
              {paymentSummary.waived === 0 && (
                <div className="text-center py-2">
                  <div className="text-xl font-bold text-primary">
                    {paymentSummary.total > 0
                      ? Math.round((paymentSummary.paid / paymentSummary.total) * 100)
                      : 0}
                    %
                  </div>
                  <div className="text-xs text-muted-foreground">Collection</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Participants List */}
        <Tabs defaultValue="participants" className="bg-card rounded-lg border overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <TabsList className="h-8 p-0.5">
              <TabsTrigger value="participants" className="h-7 px-3 text-xs">
                Participants
              </TabsTrigger>
              {isOrganizer && (
                <TabsTrigger value="activity" className="h-7 px-3 text-xs">
                  Activity
                </TabsTrigger>
              )}
            </TabsList>
            <Button
              size="sm"
              variant="ghost"
              className={`h-7 px-2 border border-border rounded ${showSearchBar ? 'bg-muted' : ''}`}
              onClick={() => setShowSearchBar(!showSearchBar)}
              disabled={participants.length === 0}
            >
              <Search className="h-3 w-3" />
            </Button>
          </div>

          <TabsContent value="participants" className="mt-0">
            <p className="text-xs text-muted-foreground px-3 py-1.5 border-b bg-muted/50">
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
                  return `${participants.length}/${event.max_participants} participants signed up`;
                } else {
                  return `${uniqueUserCount} participants signed up`;
                }
              })()}
            </p>

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
                  slots.push(
                    <ParticipantListItem
                      key={participant.id}
                      participant={participant}
                      displayName={getDisplayName(participant)}
                      isOrganizer={isOrganizer}
                      isOrganizerItem={participant.user_id === event.organizer_id}
                      isOwnClaimedSpot={isClaimedSpot(participant)}
                      claimNumber={getClaimBadgeNumber(participant)}
                      isPaid={effectiveIsPaid}
                      showRegistrationForm={showRegistrationForm}
                      onSelect={setSelectedParticipant}
                      onTogglePayment={togglePaymentStatus}
                      onWithdraw={setWithdrawingParticipant}
                    />
                  );
                }

                // Add empty slots if we have max_participants set
                if (
                  event.max_participants &&
                  filteredParticipants.length < event.max_participants
                ) {
                  const maxUsedSlot =
                    filteredParticipants.length > 0
                      ? Math.max(...filteredParticipants.map((p) => p.slot_number))
                      : 0;

                  for (
                    let slotNum = maxUsedSlot + 1;
                    slotNum <= event.max_participants;
                    slotNum++
                  ) {
                    const isFirstEmptySlot = slotNum === maxUsedSlot + 1;
                    const canClaimSpot = !!(
                      user &&
                      userRegistration &&
                      isFirstEmptySlot &&
                      showGuestRegistration
                    );

                    slots.push(
                      <EmptySlot
                        key={`empty-${slotNum}`}
                        slotNumber={slotNum}
                        canClaimSpot={canClaimSpot}
                        onClaim={openSignupDrawer}
                      />
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
          </TabsContent>

          {isOrganizer && (
            <TabsContent value="activity" className="mt-0">
              <EventActivityTimeline eventId={eventId!} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Join Event Button */}
      <div
        className={`fixed left-0 right-0 z-40 px-3 pb-2 ${isNavbarHidden ? 'bottom-4' : 'bottom-16'}`}
      >
        <Button
          onClick={() => {
            if (isEventCompleted(event.datetime, event.end_datetime)) return;
            if (isEventFull && !userRegistration) return;
            if (showRegistrationForm) {
              openSignupDrawer();
            } else if (userRegistration) {
              setShowWithdrawDialog(true);
            } else {
              handleDirectJoin();
            }
          }}
          disabled={
            isEventCompleted(event.datetime, event.end_datetime) ||
            submitting ||
            (isEventFull && !userRegistration)
          }
          className={`w-full text-white shadow-lg ${
            isEventCompleted(event.datetime, event.end_datetime) ||
            (isEventFull && !userRegistration)
              ? 'bg-muted-foreground'
              : userRegistration && !showRegistrationForm
                ? 'bg-destructive hover:bg-destructive/90'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
          }`}
          size="default"
        >
          {isEventCompleted(event.datetime, event.end_datetime) ? (
            <>
              <UserX className="h-5 w-5 mr-2" />
              Registration Closed
            </>
          ) : isEventFull && !userRegistration ? (
            <>
              <Users className="h-5 w-5 mr-2" />
              Event Full
            </>
          ) : submitting ? (
            userRegistration ? (
              'Withdrawing...'
            ) : (
              'Joining...'
            )
          ) : userRegistration ? (
            showRegistrationForm ? (
              <>
                <UserCheck className="h-5 w-5 mr-2" />
                Modify Registration
              </>
            ) : (
              <>
                <UserX className="h-5 w-5 mr-2" />
                Withdraw
              </>
            )
          ) : (
            <>
              <UserPlus className="h-5 w-5 mr-2" />
              Join Event
            </>
          )}
        </Button>
      </div>

      {/* Signup Drawer */}
      <SignupFormDrawer
        open={showSignupDrawer}
        onOpenChange={(open) => {
          if (!open) {
            setIsClaimingForOther(false);
          }
          setShowSignupDrawer(open);
        }}
        formData={signupForm}
        onFormChange={(updates) => setSignupForm((prev) => ({ ...prev, ...updates }))}
        customFields={event?.custom_fields || []}
        isClaimingForOther={isClaimingForOther}
        hasExistingRegistration={!!userRegistration}
        submitting={submitting}
        onSubmit={handleSignup}
        onWithdraw={() => setShowWithdrawDialog(true)}
        onQuickFill={quickFillFromProfile}
      />

      {/* Participant Details Sheet */}
      <ParticipantDetailsSheet
        participant={selectedParticipant}
        labels={labels}
        customFields={event?.custom_fields || []}
        isOrganizer={isOrganizer}
        isPaid={effectiveIsPaid}
        onClose={() => setSelectedParticipant(null)}
        onTogglePayment={togglePaymentStatus}
        onToggleLabel={toggleParticipantLabel}
      />

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

                try {
                  await participantService.deleteParticipant(withdrawingParticipant.id);
                  setWithdrawingParticipant(null);
                  loadEventData();
                } catch (err) {
                  errorHandler.handle(err, {
                    userId: user?.id,
                    action: 'remove participant',
                  });
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
