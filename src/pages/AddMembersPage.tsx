import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { UserPlus } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { groupService, participantService, type Group } from '@/services';
import type { Participant } from '@/services/participantService';
import { errorHandler } from '@/lib/errorHandler';
import { LoadingSpinner } from '@/components/LoadingStates';
import { ActionButton } from '@/components/ActionButton';

interface ParticipantWithEvent extends Participant {
  eventName: string;
  eventId: string;
}

export function AddMembersPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [initialLoading, setInitialLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [availableParticipants, setAvailableParticipants] = useState<ParticipantWithEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!groupId || !user) return;

    try {
      setInitialLoading(true);

      // Check admin status
      const adminStatus = await groupService.isGroupAdmin(groupId, user.id);
      setIsAdmin(adminStatus);
      setAdminLoading(false);

      if (!adminStatus) {
        errorHandler.handle(new Error('Unauthorized'), {
          userId: user.id,
          action: 'loadAddMembersPage',
        });
        navigate(`/groups/${groupId}/participants`);
        return;
      }

      // Load group data
      const groupData = await groupService.getGroupById(groupId);
      setGroup(groupData);

      // Get all events in this group
      const events = await groupService.getGroupEvents(groupId);

      // Get all participants from those events in parallel
      const allParticipants: ParticipantWithEvent[] = (
        await Promise.all(
          events.map(async (event) => {
            const participants = await participantService.getParticipantsByEventId(event.id);
            return participants.map((p) => ({
              ...p,
              eventName: event.name,
              eventId: event.id,
            }));
          })
        )
      ).flat();

      // Get existing group members to filter them out
      const existingMembers = await groupService.getGroupParticipants(groupId);
      const existingMemberIds = new Set(existingMembers.map((m) => m.id));

      // Filter out participants who are already group members
      const available = allParticipants.filter((p) => !existingMemberIds.has(p.id));

      // Deduplicate by stable identifier (user_id or email or id)
      const uniqueParticipants = new Map<string, ParticipantWithEvent>();
      available.forEach((p) => {
        const key = p.user_id || p.email || p.id;
        // Keep the first occurrence
        if (!uniqueParticipants.has(key)) {
          uniqueParticipants.set(key, p);
        }
      });

      setAvailableParticipants(Array.from(uniqueParticipants.values()));
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'loadAddMembersPage',
      });
      navigate(`/groups/${groupId}/participants`);
    } finally {
      setInitialLoading(false);
    }
  }, [groupId, user, navigate]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  const handleToggleParticipant = (participantId: string, checked: boolean) => {
    const newSelected = new Set(selectedParticipantIds);
    if (checked) {
      newSelected.add(participantId);
    } else {
      newSelected.delete(participantId);
    }
    setSelectedParticipantIds(newSelected);
  };

  const handleAddMembers = async () => {
    if (!groupId || selectedParticipantIds.size === 0) return;

    setAdding(true);
    try {
      // Get selected participant IDs as array
      const participantIds = Array.from(selectedParticipantIds);

      // Use atomic batch RPC operation
      const result = await groupService.addParticipantsToGroupBatch(groupId, participantIds);

      // Report results to user
      if (result.failed === 0) {
        // All succeeded (including skipped duplicates)
        if (result.skipped > 0) {
          errorHandler.success(
            `Added ${result.added} new ${result.added === 1 ? 'member' : 'members'}. ${result.skipped} ${result.skipped === 1 ? 'was' : 'were'} already in the group.`
          );
        } else {
          errorHandler.success(
            `Added ${result.added} ${result.added === 1 ? 'member' : 'members'} to the group`
          );
        }
        // Clear selection and reload data
        setSelectedParticipantIds(new Set());
        await loadData();
      } else if (result.added === 0 && result.skipped === 0) {
        // All failed
        errorHandler.handle(
          new Error(
            `Failed to add all ${result.failed} selected ${result.failed === 1 ? 'member' : 'members'}`
          ),
          {
            userId: user?.id,
            action: 'addMembers',
          }
        );
      } else {
        // Partial success
        errorHandler.success(
          `Added ${result.added} ${result.added === 1 ? 'member' : 'members'} successfully${result.skipped > 0 ? ` (${result.skipped} already in group)` : ''}`
        );
        if (result.failed > 0) {
          errorHandler.handle(
            new Error(
              `Failed to add ${result.failed} ${result.failed === 1 ? 'member' : 'members'}`
            ),
            {
              userId: user?.id,
              action: 'addMembers',
            }
          );
        }
        // Clear selection and reload since we can't identify which specific ones failed
        setSelectedParticipantIds(new Set());
        await loadData();
      }
    } catch (error) {
      errorHandler.handle(error, {
        userId: user?.id,
        action: 'addMembers',
      });
    } finally {
      setAdding(false);
    }
  };

  // Filter by search query
  const filteredParticipants = availableParticipants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone ?? '').includes(searchQuery)
  );

  const selectedCount = selectedParticipantIds.size;

  // Loading state
  if (authLoading || adminLoading || initialLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Unauthenticated state
  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-muted-foreground mb-4">Please sign in to add group members</p>
          <Button size="sm" onClick={() => navigate('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Unauthorized state
  if (!isAdmin || !group) {
    return (
      <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Unauthorized</h1>
          <p className="text-sm text-muted-foreground mb-4">
            You don't have permission to add members to this group
          </p>
          <Button size="sm" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav showCloseButton sticky />

      <div className="p-3 space-y-4">
        {/* Header Info */}
        <div className="space-y-1">
          <div className="text-sm font-medium">
            {availableParticipants.length}{' '}
            {availableParticipants.length === 1 ? 'participant' : 'participants'} available
          </div>
          <p className="text-xs text-muted-foreground">
            Select participants from group events to add them as group members.
          </p>
        </div>

        {availableParticipants.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-2">No participants available to add</p>
            <p className="text-xs text-muted-foreground">
              All participants from group events are already members of this group.
            </p>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="space-y-2">
              <Label htmlFor="search">Search Participants</Label>
              <Input
                id="search"
                type="search"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Participant List */}
            {filteredParticipants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No participants found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredParticipants.map((participant) => (
                  <label
                    key={participant.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedParticipantIds.has(participant.id)}
                      onCheckedChange={(checked) =>
                        handleToggleParticipant(participant.id, checked === true)
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{participant.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {participant.email || participant.phone || 'No contact info'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Joined via: {participant.eventName}
                      </div>
                    </div>
                    <Badge variant="outline">Participant</Badge>
                  </label>
                ))}
              </div>
            )}

            {selectedCount > 0 && (
              <div className="text-xs text-muted-foreground">
                {selectedCount} {selectedCount === 1 ? 'participant' : 'participants'} selected
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Button */}
      {availableParticipants.length > 0 && (
        <ActionButton
          loading={adding}
          loadingText="Adding..."
          onClick={handleAddMembers}
          disabled={selectedCount === 0}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add {selectedCount > 0 ? selectedCount : ''} {selectedCount === 1 ? 'Member' : 'Members'}
        </ActionButton>
      )}
    </div>
  );
}
