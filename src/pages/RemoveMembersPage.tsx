import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { UserMinus, AlertTriangle } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { groupService, type Group } from '@/services';
import type { GroupParticipant } from '@/services/groupService';
import { errorHandler } from '@/lib/errorHandler';
import { LoadingSpinner } from '@/components/LoadingStates';
import { ActionButton } from '@/components/ActionButton';

interface MemberWithProtection extends GroupParticipant {
  isProtected: boolean;
  role: 'owner' | 'admin' | 'member';
}

export function RemoveMembersPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [initialLoading, setInitialLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberWithProtection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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
          action: 'loadRemoveMembersPage',
        });
        navigate(`/groups/${groupId}/participants`);
        return;
      }

      // Load group data
      const groupData = await groupService.getGroupById(groupId);
      setGroup(groupData);

      // Load admins to determine protected users
      const adminsData = await groupService.getGroupAdmins(groupId);
      const adminUserIds = new Set(adminsData.map((a) => a.user_id));

      // Load all members
      const membersData = await groupService.getGroupParticipants(groupId);

      // Mark protected members (owner and admins)
      const membersWithProtection: MemberWithProtection[] = membersData.map((member) => {
        const isOwner = member.user_id === groupData.organizer_id;
        const isAdminMember = member.user_id ? adminUserIds.has(member.user_id) : false;
        const isProtected = isOwner || isAdminMember;

        return {
          ...member,
          isProtected,
          role: isOwner ? 'owner' : isAdminMember ? 'admin' : 'member',
        };
      });

      setMembers(membersWithProtection);
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'loadRemoveMembersPage',
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

  const handleToggleMember = (memberId: string, checked: boolean) => {
    const newSelected = new Set(selectedMemberIds);
    if (checked) {
      newSelected.add(memberId);
    } else {
      newSelected.delete(memberId);
    }
    setSelectedMemberIds(newSelected);
  };

  const handleRemoveMembers = async () => {
    if (!groupId || selectedMemberIds.size === 0) return;

    setRemoving(true);
    try {
      // Get selected member IDs as array
      const memberIds = Array.from(selectedMemberIds);

      // Use atomic batch RPC operation
      const result = await groupService.removeParticipantsFromGroupBatch(groupId, memberIds);

      // Close dialog first
      setShowConfirmDialog(false);

      // Report results to user
      if (result.failed === 0) {
        // All succeeded
        errorHandler.success(
          `Removed ${result.removed} ${result.removed === 1 ? 'member' : 'members'} from the group`
        );
        // Clear selection and reload data
        setSelectedMemberIds(new Set());
        await loadData();
      } else if (result.removed === 0) {
        // All failed
        errorHandler.handle(
          new Error(
            `Failed to remove all ${result.failed} selected ${result.failed === 1 ? 'member' : 'members'}`
          ),
          {
            userId: user?.id,
            action: 'removeMembers',
          }
        );
      } else {
        // Partial success
        errorHandler.success(
          `Removed ${result.removed} ${result.removed === 1 ? 'member' : 'members'} successfully`
        );
        if (result.failed > 0) {
          errorHandler.handle(
            new Error(
              `Failed to remove ${result.failed} ${result.failed === 1 ? 'member' : 'members'}`
            ),
            {
              userId: user?.id,
              action: 'removeMembers',
            }
          );
        }
        // Clear selection and reload since we can't identify which specific ones failed
        setSelectedMemberIds(new Set());
        await loadData();
      }
    } catch (error) {
      errorHandler.handle(error, {
        userId: user?.id,
        action: 'removeMembers',
      });
      setShowConfirmDialog(false);
    } finally {
      setRemoving(false);
    }
  };

  // Filter out protected members (owner and admins) and apply search query
  const removableMembers = members.filter((m) => !m.isProtected);
  const filteredMembers = removableMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.phone ?? '').includes(searchQuery)
  );
  const selectedCount = selectedMemberIds.size;

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
          <p className="text-sm text-muted-foreground mb-4">
            Please sign in to remove group members
          </p>
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
            You don't have permission to remove members from this group
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
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Removable Members ({removableMembers.length})</h2>
          <p className="text-xs text-muted-foreground">Select members to remove from the group</p>
        </div>

        <div className="space-y-3">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="search" className="text-xs">
              Search Members
            </Label>
            <Input
              id="search"
              type="search"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          {/* Member List */}
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No members found</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-card rounded-lg border overflow-hidden divide-y">
                {filteredMembers.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedMemberIds.has(member.id)}
                      onCheckedChange={(checked) => handleToggleMember(member.id, checked === true)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{member.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {member.email || member.phone || 'No contact info'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Joined {new Date(member.group_joined_at).toLocaleDateString()}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {selectedCount > 0 && (
                <div className="text-xs text-muted-foreground">
                  {selectedCount} {selectedCount === 1 ? 'member' : 'members'} selected
                </div>
              )}
            </div>
          )}

          {removableMembers.length === 0 && (
            <div className="p-4 bg-card border rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">No Members to Remove</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All current members are either the owner or admins
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Remove Button */}
      {removableMembers.length > 0 && (
        <ActionButton
          loading={removing}
          loadingText="Removing..."
          onClick={() => setShowConfirmDialog(true)}
          disabled={selectedCount === 0}
        >
          <UserMinus className="h-4 w-4 mr-2" />
          Remove {selectedCount > 0 ? selectedCount : ''}{' '}
          {selectedCount === 1 ? 'Member' : 'Members'}
        </ActionButton>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>
              Remove {selectedCount} {selectedCount === 1 ? 'Member' : 'Members'}?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              {selectedCount === 1 ? 'this member' : 'these members'} from the group?{' '}
              {selectedCount === 1 ? 'This member' : 'They'} can be re-added later from the Add
              Members page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={removing}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMembers}
              disabled={removing}
              className="w-full sm:w-auto"
            >
              {removing ? 'Removing...' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
