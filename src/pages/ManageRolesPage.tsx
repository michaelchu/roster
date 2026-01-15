import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { Shield, X, UserPlus } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { groupService, organizerService, type Group, type Organizer } from '@/services';
import type { GroupParticipant, GroupAdmin } from '@/services/groupService';
import { errorHandler } from '@/lib/errorHandler';
import { LoadingSpinner } from '@/components/LoadingStates';
import { ActionButton } from '@/components/ActionButton';

interface AdminWithDetails extends GroupAdmin {
  organizer?: Organizer | null;
}

interface MemberWithRole extends GroupParticipant {
  isOwner: boolean;
  isAdmin: boolean;
}

export function ManageRolesPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<Group | null>(null);
  const [owner, setOwner] = useState<Organizer | null>(null);
  const [admins, setAdmins] = useState<AdminWithDetails[]>([]);
  const [members, setMembers] = useState<MemberWithRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [removingAdminId, setRemovingAdminId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!groupId || !user) return;

    try {
      setInitialLoading(true);

      // Load group and verify ownership
      const groupData = await groupService.getGroupById(groupId);

      if (groupData.organizer_id !== user.id) {
        errorHandler.handle(new Error('Unauthorized'), {
          userId: user.id,
          action: 'loadManageRolesPage',
        });
        navigate('/groups');
        return;
      }

      setGroup(groupData);

      // Load owner details
      const ownerData = await organizerService.getOrganizerById(groupData.organizer_id);
      setOwner(ownerData);

      // Load current admins with their details
      const adminsData = await groupService.getGroupAdmins(groupId);
      const adminsWithDetails = await Promise.all(
        adminsData.map(async (admin) => {
          const organizer = await organizerService.getOrganizerById(admin.user_id);
          return { ...admin, organizer };
        })
      );
      setAdmins(adminsWithDetails);

      // Load all group members
      const membersData = await groupService.getGroupParticipants(groupId);

      // Filter out owner and existing admins, mark their roles
      const adminUserIds = new Set(adminsData.map((a) => a.user_id));
      const membersWithRoles: MemberWithRole[] = membersData.map((member) => ({
        ...member,
        isOwner: member.user_id === groupData.organizer_id,
        isAdmin: member.user_id ? adminUserIds.has(member.user_id) : false,
      }));

      setMembers(membersWithRoles);
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'loadManageRolesPage',
      });
      navigate('/groups');
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

  const handlePromoteToAdmin = async () => {
    if (!groupId || selectedMemberIds.size === 0) return;

    setSaving(true);
    try {
      // Get user_ids from selected members
      const selectedMembers = members.filter((m) => selectedMemberIds.has(m.id) && m.user_id);

      // Promote each member to admin
      for (const member of selectedMembers) {
        if (member.user_id) {
          await groupService.addGroupAdmin(groupId, member.user_id);
        }
      }

      errorHandler.success(
        `Promoted ${selectedMembers.length} ${selectedMembers.length === 1 ? 'member' : 'members'} to admin`
      );

      // Clear selection and reload data
      setSelectedMemberIds(new Set());
      await loadData();
    } catch (error) {
      errorHandler.handle(error, {
        userId: user?.id,
        action: 'promoteToAdmin',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string, userId: string) => {
    if (!groupId) return;

    setRemovingAdminId(adminId);
    try {
      await groupService.removeGroupAdmin(groupId, userId);
      errorHandler.success('Admin role removed');
      await loadData();
    } catch (error) {
      errorHandler.handle(error, {
        userId: user?.id,
        action: 'removeAdmin',
      });
    } finally {
      setRemovingAdminId(null);
    }
  };

  // Filter eligible members (not owner, not already admin, has user_id)
  const eligibleMembers = members.filter(
    (m) => !m.isOwner && !m.isAdmin && m.user_id && !m.claimed_by_user_id
  );

  // Filter by search query
  const filteredMembers = eligibleMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Loading state
  if (authLoading || initialLoading) {
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
          <p className="text-sm text-muted-foreground mb-4">Please sign in to manage group roles</p>
          <Button size="sm" onClick={() => navigate('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  // Unauthorized state
  if (!group) {
    return (
      <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Unauthorized</h1>
          <p className="text-sm text-muted-foreground mb-4">
            You don't have permission to manage roles for this group
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
      <TopNav title="Manage Roles" showBackButton sticky />

      <div className="p-3 space-y-6">
        {/* Section 1: Group Owner */}
        <div className="space-y-3 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">Group Owner</h2>
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{owner?.name || 'Unknown'}</div>
                <div className="text-xs text-muted-foreground">Full access to group</div>
              </div>
              <Badge variant="default">Owner</Badge>
            </div>
          </div>
        </div>

        {/* Section 2: Current Admins */}
        <div className="space-y-3 pb-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              Current Admins {admins.length > 0 && `(${admins.length})`}
            </h2>
          </div>
          {admins.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No admins yet. Promote members below to help manage this group.
            </p>
          ) : (
            <div className="space-y-2">
              {admins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {admin.organizer?.name || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Can manage members and events
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Admin</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleRemoveAdmin(admin.id, admin.user_id)}
                      disabled={removingAdminId === admin.id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Promote Members */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium">
            Promote Members to Admin {eligibleMembers.length > 0 && `(${eligibleMembers.length})`}
          </h2>

          {eligibleMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No eligible members to promote. Only registered members with accounts can become
              admins.
            </p>
          ) : (
            <>
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="search">Search Members</Label>
                <Input
                  id="search"
                  type="search"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Member List */}
              {filteredMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No members found</p>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedMemberIds.has(member.id)}
                        onCheckedChange={(checked) =>
                          handleToggleMember(member.id, checked === true)
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{member.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {member.email || member.phone || 'No contact info'}
                        </div>
                      </div>
                      <Badge variant="outline">Member</Badge>
                    </label>
                  ))}
                </div>
              )}

              {selectedMemberIds.size > 0 && (
                <div className="text-xs text-muted-foreground">
                  {selectedMemberIds.size} {selectedMemberIds.size === 1 ? 'member' : 'members'}{' '}
                  selected
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Promote Button */}
      {eligibleMembers.length > 0 && (
        <ActionButton
          loading={saving}
          loadingText="Promoting..."
          onClick={handlePromoteToAdmin}
          disabled={selectedMemberIds.size === 0}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Promote {selectedMemberIds.size > 0 ? selectedMemberIds.size : ''} to Admin
        </ActionButton>
      )}
    </div>
  );
}
