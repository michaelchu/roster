import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Plus, UsersRound, Calendar, Users } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { groupService, type Group } from '@/services';
import { useLoadingState } from '@/hooks/useLoadingState';
import { EventListSkeleton } from '@/components/LoadingStates';
import { ActionButton } from '@/components/ActionButton';

export function GroupsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isLoading, data: groups, execute: loadGroups } = useLoadingState<Group[]>([]);

  const loadGroupsCallback = useCallback(async () => {
    if (!user) return [];
    return await groupService.getGroupsByOrganizer(user.id);
  }, [user]);

  useEffect(() => {
    if (user) {
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
          <Button size="sm" onClick={() => navigate('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav title="My Groups" sticky />

      <div className="p-3 space-y-3">
        {isLoading ? (
          <EventListSkeleton count={3} />
        ) : groups && groups.length === 0 ? (
          <div className="bg-card rounded-lg p-6 border text-center">
            <UsersRound className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-base font-medium mb-2">No Groups Yet</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Create your first group to organize events and manage participants
            </p>
            <Button size="sm" className="w-full" onClick={() => navigate('/groups/new')}>
              <Plus className="h-4 w-4 mr-1" />
              Create Group
            </Button>
          </div>
        ) : (
          <>
            <div className="bg-card rounded-lg border overflow-hidden">
              {/* Groups List */}
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
          </>
        )}
      </div>

      {/* New Group Button above navbar */}
      <ActionButton onClick={() => navigate('/groups/new')}>
        <Plus className="h-5 w-5 mr-2" />
        New Group
      </ActionButton>
    </div>
  );
}
