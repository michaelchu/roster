import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  labels: any[];
}

export function ParticipantsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (user) {
      loadParticipants();
    }
  }, [user]);

  const loadParticipants = async () => {
    try {
      // First get all events for this organizer
      const { data: events } = await supabase
        .from("events")
        .select("id")
        .eq("organizer_id", user?.id);

      if (!events || events.length === 0) {
        setParticipants([]);
        setLoading(false);
        return;
      }

      const eventIds = events.map((e) => e.id);

      // Get all participants for these events
      const { data: participantsData } = await supabase
        .from("participants")
        .select(
          `
          *,
          events!inner (
            id,
            name
          )
        `,
        )
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });

      if (participantsData) {
        // Get labels for each participant
        const participantsWithLabels = await Promise.all(
          participantsData.map(async (p) => {
            const { data: labelData } = await supabase
              .from("participant_labels")
              .select("labels!inner(*)")
              .eq("participant_id", p.id);

            return {
              ...p,
              event: p.events,
              labels: labelData?.map((l) => l.labels) || [],
            };
          }),
        );
        setParticipants(participantsWithLabels as any);
      }
    } catch (error) {
      console.error("Error loading participants:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.includes(searchQuery) ||
      p.event.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 pb-14 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
          <p className="text-sm text-gray-500 mb-4">
            Please sign in to view participants
          </p>
          <Button size="sm" onClick={() => navigate("/auth/login")}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-14">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">All Participants</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <div className="text-sm text-gray-500 text-center py-8">
            Loading...
          </div>
        ) : participants.length === 0 ? (
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
              <div className="p-3 bg-gray-50">
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
            </div>

            <div className="bg-white rounded-lg border divide-y">
              {filteredParticipants.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-gray-500">No participants found</p>
                </div>
              ) : (
                filteredParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="p-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          {participant.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {participant.email ||
                            participant.phone ||
                            "No contact info"}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Event: {participant.event.name}
                        </div>
                        {participant.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {participant.labels.map((label) => (
                              <Badge
                                key={label.id}
                                variant="outline"
                                className="text-xs h-5"
                              >
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
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
