import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Users, Plus, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface UpcomingEvent {
  id: string;
  name: string;
  datetime: string | null;
  location: string | null;
  isOrganizer: boolean;
  participantCount?: number;
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState<"week" | "month">("week");

  useEffect(() => {
    if (user) {
      loadUpcomingEvents();
    }
  }, [user, timePeriod]);

  const loadUpcomingEvents = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (timePeriod === "week") {
        // Get start and end of current week
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay()); // Sunday
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // Saturday
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Get start and end of current month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);

        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      const events: UpcomingEvent[] = [];

      // Get events the user organized
      const { data: organizedEvents } = await supabase
        .from("events")
        .select("id, name, datetime, location")
        .eq("organizer_id", user?.id)
        .gte("datetime", startDate.toISOString())
        .lte("datetime", endDate.toISOString())
        .order("datetime", { ascending: true });

      if (organizedEvents) {
        // Get participant counts for organized events
        for (const event of organizedEvents) {
          const { count } = await supabase
            .from("participants")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event.id);

          events.push({
            ...event,
            isOrganizer: true,
            participantCount: count || 0,
          });
        }
      }

      // Get events the user signed up for as a participant (if they have user_id stored)
      const { data: participantEvents } = await supabase
        .from("participants")
        .select(
          `
          events!inner (
            id,
            name,
            datetime,
            location,
            organizer_id
          )
        `,
        )
        .eq("user_id", user?.id)
        .gte("events.datetime", startDate.toISOString())
        .lte("events.datetime", endDate.toISOString());

      if (participantEvents) {
        for (const participantEvent of participantEvents) {
          const event = participantEvent.events;
          // Don't duplicate events the user is organizing
          if (event.organizer_id !== user?.id) {
            events.push({
              id: event.id,
              name: event.name,
              datetime: event.datetime,
              location: event.location,
              isOrganizer: false,
            });
          }
        }
      }

      // Sort all events by datetime
      events.sort((a, b) => {
        if (!a.datetime) return 1;
        if (!b.datetime) return -1;
        return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      });

      setUpcomingEvents(events.slice(0, 3)); // Show max 3 events
    } catch (error) {
      console.error("Error loading upcoming events:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-14">
      <div className="bg-white border-b">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">Venu</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {user ? (
          <>
            <div className="bg-white rounded-lg p-4 border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium">Quick Actions</h2>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-20 flex-col gap-2"
                  onClick={() => navigate("/events/new")}
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-xs">Create Event</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-20 flex-col gap-2"
                  onClick={() => navigate("/events")}
                >
                  <Calendar className="h-5 w-5" />
                  <span className="text-xs">My Events</span>
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium">Upcoming Events</h2>
                  <Select
                    value={timePeriod}
                    onValueChange={(value: "week" | "month") =>
                      setTimePeriod(value)
                    }
                  >
                    <SelectTrigger className="w-32 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="p-4 text-xs text-gray-500 text-center">
                  Loading...
                </div>
              ) : upcomingEvents.length === 0 ? (
                <div className="p-4 text-xs text-gray-500 text-center">
                  No events {timePeriod === "week" ? "this week" : "this month"}
                </div>
              ) : (
                <div className="divide-y">
                  {upcomingEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-medium truncate">
                              {event.name}
                            </h3>
                            <Badge
                              variant={
                                event.isOrganizer ? "default" : "secondary"
                              }
                              className="text-xs h-4 px-1.5"
                            >
                              {event.isOrganizer ? "Organizer" : "Attending"}
                            </Badge>
                          </div>
                          {event.datetime && (
                            <div className="text-xs text-gray-500 mb-0.5">
                              {new Date(event.datetime).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                },
                              )}
                            </div>
                          )}
                          {event.location && (
                            <div className="text-xs text-gray-400 truncate">
                              {event.location}
                            </div>
                          )}
                          {event.isOrganizer &&
                            event.participantCount !== undefined && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                                <Users className="h-3 w-3" />
                                <span>
                                  {event.participantCount} participant
                                  {event.participantCount !== 1 ? "s" : ""}
                                </span>
                              </div>
                            )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg p-6 border text-center">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
            <h2 className="text-base font-medium mb-2">Welcome to Venu</h2>
            <p className="text-xs text-gray-500 mb-4">
              Sign in to create and manage your events
            </p>
            <Button
              size="sm"
              className="w-full"
              onClick={() => navigate("/auth/login")}
            >
              Sign In
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
