import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { Search, ArrowUpDown, UsersRound, UserMinus, UserCog, LogOut } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { UserAvatar } from '@/components/UserAvatar';
import { groupService, type GroupParticipant, type Group } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { useLoadingState } from '@/hooks/useLoadingState';
import { ParticipantsPageSkeleton } from '@/components/ParticipantsPageSkeleton';
import { SortDrawer, type SortOption } from '@/components/SortDrawer';

const SORT_OPTIONS: SortOption[] = [
  { value: 'latest', label: 'Latest Join Date' },
  { value: 'earliest', label: 'Earliest Join Date' },
  { value: 'nameAsc', label: 'Name A-Z' },
  { value: 'nameDesc', label: 'Name Z-A' },
  { value: 'eventAsc', label: 'Event A-Z' },
  { value: 'eventDesc', label: 'Event Z-A' },
];

export function GroupParticipantsPage() {
  const navigate = useNavigate();
  const { groupId } = useParams<{ groupId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showSortDrawer, setShowSortDrawer] = useState(false);
  const [sortOption, setSortOption] = useState('latest');
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const {
    isLoading: participantsLoading,
    data: participants,
    execute: loadParticipants,
  } = useLoadingState<GroupParticipant[]>([]);

  const loadGroup = useCallback(async () => {
    if (!groupId) return;

    try {
      setGroupLoading(true);
      const groupData = await groupService.getGroupById(groupId);
      setGroup(groupData);
    } catch (error) {
      console.error('Error loading group:', error);
      errorHandler.handle(error);
      navigate('/groups');
    } finally {
      setGroupLoading(false);
    }
  }, [groupId, navigate]);

  const loadParticipantsCallback = useCallback(async () => {
    if (!groupId) return [];
    return await groupService.getGroupParticipants(groupId);
  }, [groupId]);

  const checkAdminStatus = useCallback(async () => {
    if (!groupId || !user?.id) {
      setIsAdmin(false);
      setAdminLoading(false);
      return;
    }

    try {
      setAdminLoading(true);
      const adminStatus = await groupService.isGroupAdmin(groupId, user.id);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setAdminLoading(false);
    }
  }, [groupId, user?.id]);

  const confirmLeaveGroup = useCallback(async () => {
    if (!groupId || !user?.id || !group) return;

    // Don't allow organizer to leave their own group
    if (group.organizer_id === user.id) {
      errorHandler.handle(new Error('You cannot leave a group you created'));
      return;
    }

    setLeavingGroup(true);
    try {
      await groupService.leaveGroup(groupId, user.id);
      errorHandler.success('You have left the group');
      setShowLeaveDialog(false);
      navigate('/groups');
    } catch (error) {
      console.error('Error leaving group:', error);
      errorHandler.handle(error);
    } finally {
      setLeavingGroup(false);
    }
  }, [groupId, user?.id, group, navigate]);

  useEffect(() => {
    if (user) {
      loadGroup();
      loadParticipants(loadParticipantsCallback);
      checkAdminStatus();
    }
  }, [user, loadGroup, loadParticipants, loadParticipantsCallback, checkAdminStatus]);

  const sortedParticipants = (participants: GroupParticipant[]) => {
    const sorted = [...participants];
    switch (sortOption) {
      case 'earliest':
        return sorted.sort(
          (a, b) => new Date(a.group_joined_at).getTime() - new Date(b.group_joined_at).getTime()
        );
      case 'latest':
        return sorted.sort(
          (a, b) => new Date(b.group_joined_at).getTime() - new Date(a.group_joined_at).getTime()
        );
      case 'nameAsc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'nameDesc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'eventAsc':
        return sorted.sort((a, b) => (a.event?.name ?? '').localeCompare(b.event?.name ?? ''));
      case 'eventDesc':
        return sorted.sort((a, b) => (b.event?.name ?? '').localeCompare(a.event?.name ?? ''));
      default:
        return sorted;
    }
  };

  const filteredParticipants = sortedParticipants(
    participants?.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.phone ?? '').includes(searchQuery) ||
        (p.event?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    ) || []
  );

  if (authLoading || groupLoading || adminLoading) {
    return <ParticipantsPageSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-muted-foreground mb-4">Please sign in to view group members</p>
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

  if (participantsLoading) {
    return <ParticipantsPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background pb-14">
      <TopNav sticky />

      <div className="p-3 space-y-3">
        {/* Group Name Header */}
        <div className="pb-3 border-b">
          <h2 className="text-base font-semibold break-words">{group.name}</h2>
        </div>
        {/* Quick Actions - Only visible to admins */}
        {isAdmin && (
          <div className="bg-card rounded-lg p-3 border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-20 flex-col gap-2"
                onClick={() => navigate(`/groups/${groupId}/manage-roles`)}
              >
                <UserCog className="h-5 w-5" />
                <span className="text-xs">Manage</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-20 flex-col gap-2"
                onClick={() => navigate(`/groups/${groupId}/remove-members`)}
                disabled={!participants || participants.length === 0}
              >
                <UserMinus className="h-5 w-5" />
                <span className="text-xs">Remove</span>
              </Button>
            </div>
          </div>
        )}

        {!participants || participants.length === 0 ? (
          <div className="bg-card rounded-lg p-6 border text-center">
            <UsersRound className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-base font-medium mb-2">No Members Yet</h2>
            <p className="text-xs text-muted-foreground">
              Members will appear here once people sign up for events in this group
            </p>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-lg border overflow-hidden">
              {/* Header */}
              <div className="p-3 border-b flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {filteredParticipants.length}{' '}
                    {filteredParticipants.length === 1 ? 'member' : 'members'}
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
                    onClick={() => setShowSortDrawer(true)}
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
                      placeholder="Search by name, email, phone, or event..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-8 text-sm"
                    />
                  </div>
                </div>
              )}
              {/* Participants List */}
              <div className="divide-y">
                {filteredParticipants.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">No members found</p>
                  </div>
                ) : (
                  filteredParticipants.map((participant) => {
                    const isCurrentUser = participant.user_id === user?.id;
                    const isOrganizer = group?.organizer_id === user?.id;
                    const canLeave = isCurrentUser && !isOrganizer;

                    return (
                      <div key={participant.id} className="w-full p-3 border-b last:border-b-0">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={participant.name}
                            avatarUrl={participant.avatar_url}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{participant.name}</div>
                          </div>
                          {canLeave && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowLeaveDialog(true)}
                              disabled={leavingGroup}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
                            >
                              <LogOut className="h-4 w-4 mr-1" />
                              <span className="text-xs">Leave</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sort Drawer */}
      <SortDrawer
        open={showSortDrawer}
        onOpenChange={setShowSortDrawer}
        options={SORT_OPTIONS}
        selectedValue={sortOption}
        onSelect={setSortOption}
      />

      {/* Leave Group Confirmation Dialog */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this group? You will no longer have access to group
              events and will need to be re-invited to rejoin.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="destructive"
              onClick={confirmLeaveGroup}
              disabled={leavingGroup}
              className="w-full sm:w-auto"
            >
              {leavingGroup ? 'Leaving...' : 'Leave Group'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowLeaveDialog(false)}
              disabled={leavingGroup}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
