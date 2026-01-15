import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { Plus, UsersRound, Calendar, Users, Contact } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { groupService, type Group, type GroupContact } from '@/services';
import { useLoadingState } from '@/hooks/useLoadingState';
import { EventListSkeleton } from '@/components/LoadingStates';
import { ActionButton } from '@/components/ActionButton';

export function GroupsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isLoading, data: groups, execute: loadGroups } = useLoadingState<Group[]>([]);
  const {
    isLoading: isLoadingContacts,
    data: contacts,
    execute: loadContacts,
  } = useLoadingState<GroupContact[]>([]);

  const loadGroupsCallback = useCallback(async () => {
    if (!user) return [];
    return await groupService.getGroupsByOrganizer(user.id);
  }, [user]);

  const loadContactsCallback = useCallback(async () => {
    if (!user) return [];
    return await groupService.getAllContactsFromGroups(user.id);
  }, [user]);

  useEffect(() => {
    if (user) {
      loadGroups(loadGroupsCallback);
      loadContacts(loadContactsCallback);
    }
  }, [user, loadGroups, loadGroupsCallback, loadContacts, loadContactsCallback]);

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
      <TopNav title="Groups" sticky />

      <Tabs defaultValue="groups" className="w-full">
        <div className="bg-card border-b px-3 py-2">
          <TabsList className="w-full h-10">
            <TabsTrigger value="groups" className="flex-1">
              Groups
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex-1">
              Contacts
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="groups" className="p-3 space-y-3 mt-0">
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
          <ActionButton onClick={() => navigate('/groups/new')}>
            <Plus className="h-5 w-5 mr-2" />
            New Group
          </ActionButton>
        </TabsContent>

        <TabsContent value="contacts" className="p-3 space-y-3 mt-0">
          {isLoadingContacts ? (
            <EventListSkeleton count={3} />
          ) : contacts && contacts.length === 0 ? (
            <div className="bg-card rounded-lg p-6 border text-center">
              <Contact className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h2 className="text-base font-medium mb-2">No Contacts Yet</h2>
              <p className="text-xs text-muted-foreground">
                Participants from your group events will appear here
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="divide-y">
                {(contacts || []).map((contact) => (
                  <div key={contact.id} className="p-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-medium">{contact.name}</h3>
                      {contact.email && (
                        <p className="text-xs text-muted-foreground">{contact.email}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
