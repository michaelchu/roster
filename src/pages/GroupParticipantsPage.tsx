import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Search, ArrowUpDown, UsersRound } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showSortDrawer, setShowSortDrawer] = useState(false);
  const [sortOption, setSortOption] = useState('latest');
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

  useEffect(() => {
    if (user) {
      loadGroup();
      loadParticipants(loadParticipantsCallback);
    }
  }, [user, loadGroup, loadParticipants, loadParticipantsCallback]);

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
        return sorted.sort((a, b) => a.event.name.localeCompare(b.event.name));
      case 'eventDesc':
        return sorted.sort((a, b) => b.event.name.localeCompare(a.event.name));
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
        p.event.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []
  );

  if (authLoading || groupLoading) {
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
      <TopNav
        title={`${group.name} Members`}
        showBackButton
        backPath={`/groups/${groupId}`}
        sticky
      />

      <div className="p-3 space-y-3">
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
                  filteredParticipants.map((participant) => (
                    <button
                      type="button"
                      key={participant.id}
                      className="w-full text-left p-3 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/signup/${participant.event.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/signup/${participant.event.id}`);
                        }
                      }}
                      aria-label={`View event ${participant.event.name}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm font-medium truncate">{participant.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {participant.email || participant.phone || 'No contact info'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Joined via: {participant.event.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Member since:{' '}
                            {new Date(participant.group_joined_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex-shrink-0">
                          <Badge variant="outline" className="text-xs h-5">
                            Member
                          </Badge>
                        </div>
                      </div>
                    </button>
                  ))
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
    </div>
  );
}
