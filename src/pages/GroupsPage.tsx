import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Plus, UsersRound, Calendar, Users } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { groupService, type Group } from '@/services';
import { useLoadingState } from '@/hooks/useLoadingState';
import { EventListSkeleton } from '@/components/LoadingStates';

export function GroupsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isLoading, data: groups, execute: loadGroups } = useLoadingState<Group[]>([]);
  const hasLoadedRef = useRef(false);

  const loadGroupsCallback = useCallback(async () => {
    if (!user) return [];

    // Get both groups user organizes and groups user is a member of
    const [organizedGroups, memberGroups] = await Promise.all([
      groupService.getGroupsByOrganizer(user.id),
      groupService.getGroupsByUser(user.id),
    ]);

    // Combine and deduplicate by group ID
    const groupMap = new Map<string, Group>();

    // Add organized groups first
    organizedGroups.forEach((group) => groupMap.set(group.id, group));

    // Add member groups (won't override organized groups due to same ID)
    memberGroups.forEach((group) => {
      if (!groupMap.has(group.id)) {
        groupMap.set(group.id, group);
      }
    });

    // Convert back to array and sort by created_at
    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [user]);

  useEffect(() => {
    if (user && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadGroups(loadGroupsCallback);
    }
  }, [user, loadGroups, loadGroupsCallback]);

  if (loading) {
    return <EventListSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-32 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-muted-foreground mb-4">Please sign in to view your groups</p>
          <Button onClick={() => navigate('/auth/login')}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav sticky />

      <div className="p-3 space-y-3">
        {isLoading ? (
          <EventListSkeleton count={3} />
        ) : groups && groups.length === 0 ? (
          <div className="bg-card rounded-lg p-6 border text-center">
            <UsersRound className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-base font-medium mb-2">No Groups Yet</h2>
            <p className="text-xs text-muted-foreground">
              Groups help you organize recurring events for the same participants
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="divide-y">
              {(groups || []).map((group) => (
                <button
                  key={group.id}
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="w-full p-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="flex flex-col">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold truncate">{group.name}</h3>
                      {group.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {group.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{group.event_count || 0} events</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{group.participant_count || 0} members</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(group.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => navigate('/groups/new')}
        className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg drop-shadow-md flex items-center justify-center font-medium transition-all"
        aria-label="New Group"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}
