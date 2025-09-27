import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Users, Search, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TopNav } from '@/components/TopNav';
import { ParticipantsPageSkeleton } from '@/components/ParticipantsPageSkeleton';
import { Drawer, DrawerContent } from '@/components/ui/drawer';

interface Participant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  event: {
    id: string;
    name: string;
  };
  labels: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Renders the participants management page for the authenticated organizer.
 *
 * Loads participants for the current signed-in organizer, fetches per-participant labels,
 * provides a searchable list, and displays appropriate UI for loading, empty, and unauthenticated states.
 *
 * @returns The page's JSX containing top navigation, search input, participants list with labels and event info, an empty-state card when there are no participants, a loading skeleton while data is being fetched, and a sign-in prompt when no user is authenticated.
 */
export function ParticipantsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [showSortDrawer, setShowSortDrawer] = useState(false);
  const [sortOption, setSortOption] = useState('latest');

  useEffect(() => {
    if (user) {
      loadParticipants();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadParticipants = async () => {
    try {
      // First get all events for this organizer
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', user?.id || '');

      if (!events || events.length === 0) {
        setParticipants([]);
        setLoading(false);
        return;
      }

      const eventIds = events.map((e) => e.id);

      // Get all participants for these events, excluding the authenticated user only if they have a user_id
      const { data: participantsData } = await supabase
        .from('participants')
        .select(
          `
          *,
          events!inner (
            id,
            name
          )
        `
        )
        .in('event_id', eventIds)
        .or(`user_id.is.null,user_id.neq.${user?.id || ''}`)
        .order('created_at', { ascending: false });

      if (participantsData) {
        // Batch fetch all labels for all participants in one query
        const participantIds = participantsData.map((p) => p.id);
        const { data: allLabelData } = await supabase
          .from('participant_labels')
          .select('participant_id, labels!inner(*)')
          .in('participant_id', participantIds);

        // Group labels by participant_id for efficient lookup
        const labelsByParticipant = new Map<string, any[]>();
        allLabelData?.forEach((item) => {
          const participantId = item.participant_id;
          if (!labelsByParticipant.has(participantId)) {
            labelsByParticipant.set(participantId, []);
          }
          labelsByParticipant.get(participantId)!.push(item.labels);
        });

        // Map participants with their labels
        const participantsWithLabels = participantsData.map((p) => ({
          ...p,
          event: p.events,
          labels: labelsByParticipant.get(p.id) || [],
        }));

        setParticipants(participantsWithLabels as any); // eslint-disable-line @typescript-eslint/no-explicit-any
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedParticipants = (participants: Participant[]) => {
    const sorted = [...participants];
    switch (sortOption) {
      case 'earliest':
        return sorted.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      case 'latest':
        return sorted.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
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
    participants.filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.email ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.phone ?? '').includes(searchQuery) ||
        (p.event?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-gray-500 mb-4">Please sign in to view participants</p>
          <Button size="sm" onClick={() => navigate('/auth/login')}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <ParticipantsPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-14">
      <TopNav title="All Participants" sticky />

      <div className="p-3 space-y-3">
        {participants.length === 0 ? (
          <div className="bg-white rounded-lg p-6 border text-center">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <h2 className="text-base font-medium mb-2">No Participants Yet</h2>
            <p className="text-xs text-gray-500">
              Participants will appear here once they sign up for your events
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border overflow-hidden">
              {/* Header */}
              <div className="p-3 border-b flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {filteredParticipants.length}{' '}
                    {filteredParticipants.length === 1 ? 'participant' : 'participants'}
                  </p>
                </div>
                <div className="flex border border-gray-300 rounded">
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-7 px-2 rounded-r-none border-0 border-r border-gray-300 ${
                      showSearchBar ? 'bg-gray-200' : ''
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
                <div className="p-3 border-b bg-gray-50">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
                    <p className="text-sm text-gray-500">No participants found</p>
                  </div>
                ) : (
                  filteredParticipants.map((participant) => (
                    <button
                      type="button"
                      key={participant.id}
                      className="w-full text-left p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/events/${participant.event.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/events/${participant.event.id}`);
                        }
                      }}
                      aria-label={`View event ${participant.event.name}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{participant.name}</div>
                          <div className="text-xs text-gray-500">
                            {participant.email || participant.phone || 'No contact info'}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            Event: {participant.event.name}
                          </div>
                          {participant.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {participant.labels.map((label) => (
                                <Badge key={label.id} variant="outline" className="text-xs h-5">
                                  {label.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(participant.created_at).toLocaleDateString()}
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
      <Drawer open={showSortDrawer} onOpenChange={setShowSortDrawer}>
        <DrawerContent className="p-0">
          <div className="py-4 px-4">
            <button
              className={`w-full text-center py-4 text-base font-semibold border-b border-gray-200 ${
                sortOption === 'latest'
                  ? 'bg-blue-100 text-blue-600 rounded-lg'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                setSortOption('latest');
                setShowSortDrawer(false);
              }}
            >
              Latest Registration
            </button>
            <button
              className={`w-full text-center py-4 text-base font-semibold border-b border-gray-200 ${
                sortOption === 'earliest'
                  ? 'bg-blue-100 text-blue-600 rounded-lg'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                setSortOption('earliest');
                setShowSortDrawer(false);
              }}
            >
              Earliest Registration
            </button>
            <button
              className={`w-full text-center py-4 text-base font-semibold border-b border-gray-200 ${
                sortOption === 'nameAsc'
                  ? 'bg-blue-100 text-blue-600 rounded-lg'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                setSortOption('nameAsc');
                setShowSortDrawer(false);
              }}
            >
              Name A-Z
            </button>
            <button
              className={`w-full text-center py-4 text-base font-semibold border-b border-gray-200 ${
                sortOption === 'nameDesc'
                  ? 'bg-blue-100 text-blue-600 rounded-lg'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                setSortOption('nameDesc');
                setShowSortDrawer(false);
              }}
            >
              Name Z-A
            </button>
            <button
              className={`w-full text-center py-4 text-base font-semibold border-b border-gray-200 ${
                sortOption === 'eventAsc'
                  ? 'bg-blue-100 text-blue-600 rounded-lg'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                setSortOption('eventAsc');
                setShowSortDrawer(false);
              }}
            >
              Event A-Z
            </button>
            <button
              className={`w-full text-center py-4 text-base font-semibold ${
                sortOption === 'eventDesc'
                  ? 'bg-blue-100 text-blue-600 rounded-lg'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => {
                setSortOption('eventDesc');
                setShowSortDrawer(false);
              }}
            >
              Event Z-A
            </button>
            <div className="border-t border-gray-200">
              <button
                className="w-full text-center py-4 text-base font-semibold text-red-600 hover:bg-gray-50"
                onClick={() => setShowSortDrawer(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
