import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft,
  Users,
  Share2,
  Download,
  Plus,
  Tag,
  X,
  Search,
  Edit,
  UserPlus,
  UserCheck,
  UserX,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Participant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  labels: Label[];
  responses: Record<string, any>;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface EventData {
  id: string;
  name: string;
  description: string | null;
  datetime: string | null;
  location: string | null;
  max_participants: number | null;
  organizer_id: string;
  custom_fields: any[];
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);
  const [showSignupDrawer, setShowSignupDrawer] = useState(false);
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    responses: {} as Record<string, any>,
  });
  const [submitting, setSubmitting] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [userRegistration, setUserRegistration] = useState<Participant | null>(
    null,
  );
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);

  useEffect(() => {
    if (eventId && user) {
      loadEventData();
    }
  }, [eventId, user]);

  const loadEventData = async () => {
    if (!eventId) return;

    try {
      // Load event
      const { data: eventData, error: eventError } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Load labels
      const { data: labelsData } = await supabase
        .from("labels")
        .select("*")
        .eq("event_id", eventId)
        .order("name");

      setLabels(labelsData || []);

      // Load participants
      const { data: participantsData } = await supabase
        .from("participants")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (participantsData) {
        // Add empty labels array since we removed labels functionality
        const participantsWithLabels = participantsData.map((p) => ({
          ...p,
          labels: [],
        }));
        setParticipants(participantsWithLabels as any);

        // Check if current user is already registered
        let currentUserRegistration = participantsWithLabels.find(
          (p) =>
            (user?.id && p.user_id === user.id) ||
            (user?.email && p.email === user.email),
        );

        // If not found by user_id but found by email, update the participant record to link to user
        if (!currentUserRegistration && user?.email) {
          const emailMatch = participantsWithLabels.find(
            (p) => p.email === user.email && !p.user_id,
          );
          if (emailMatch) {
            // Update participant to link to current user
            supabase
              .from("participants")
              .update({ user_id: user.id })
              .eq("id", emailMatch.id)
              .then(() => {
                // Reload data to reflect the update
                loadEventData();
              });
            currentUserRegistration = emailMatch;
          }
        }

        setUserRegistration(currentUserRegistration || null);
      }
    } catch (error) {
      console.error("Error loading event data:", error);
    } finally {
      setLoading(false);
    }
  };

  const shareEvent = () => {
    const url = `${window.location.origin}/signup/${eventId}`;
    if (navigator.share) {
      navigator.share({
        title: event?.name,
        text: `Sign up for ${event?.name}`,
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
      alert("Signup link copied to clipboard!");
    }
  };

  const exportToCSV = () => {
    if (!participants.length) return;

    const headers = ["Name", "Email", "Phone", "Labels", "Sign Up Date"];
    if (event?.custom_fields) {
      event.custom_fields.forEach((field) => headers.push(field.label));
    }

    const rows = participants.map((p) => {
      const row = [
        p.name,
        p.email || "",
        p.phone || "",
        p.labels.map((l) => l.name).join("; "),
        new Date(p.created_at).toLocaleDateString(),
      ];
      if (event?.custom_fields) {
        event.custom_fields.forEach((field) => {
          row.push(p.responses[field.id] || "");
        });
      }
      return row;
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event?.name || "participants"}.csv`;
    a.click();
  };

  const createLabel = async () => {
    if (!newLabelName.trim() || !eventId) return;

    try {
      const { data, error } = await supabase
        .from("labels")
        .insert({
          event_id: eventId,
          name: newLabelName.trim(),
        })
        .select()
        .single();

      if (error) throw error;
      setLabels([...labels, data]);
      setNewLabelName("");
    } catch (error) {
      console.error("Error creating label:", error);
    }
  };

  const deleteLabel = async (labelId: string) => {
    try {
      await supabase.from("labels").delete().eq("id", labelId);
      setLabels(labels.filter((l) => l.id !== labelId));
    } catch (error) {
      console.error("Error deleting label:", error);
    }
  };

  const toggleParticipantLabel = async (
    participant: Participant,
    label: Label,
  ) => {
    const hasLabel = participant.labels.some((l) => l.id === label.id);

    try {
      if (hasLabel) {
        await supabase
          .from("participant_labels")
          .delete()
          .match({ participant_id: participant.id, label_id: label.id });
      } else {
        await supabase
          .from("participant_labels")
          .insert({ participant_id: participant.id, label_id: label.id });
      }
      loadEventData();
    } catch (error) {
      console.error("Error toggling label:", error);
    }
  };

  const openSignupDrawer = () => {
    if (userRegistration) {
      // Pre-fill form with existing registration data
      setSignupForm({
        name: userRegistration.name || "",
        email: userRegistration.email || "",
        phone: userRegistration.phone || "",
        notes: userRegistration.notes || "",
        responses: userRegistration.responses || {},
      });
    } else {
      // Reset form for new registration
      setSignupForm({
        name: "",
        email: "",
        phone: "",
        notes: "",
        responses: {},
      });
    }
    setShowSignupDrawer(true);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    setSubmitting(true);
    setSignupError("");

    try {
      if (userRegistration) {
        // Update existing registration
        const { error } = await supabase
          .from("participants")
          .update({
            name: signupForm.name,
            email: signupForm.email,
            phone: signupForm.phone,
            notes: signupForm.notes,
            responses: signupForm.responses,
          })
          .eq("id", userRegistration.id);

        if (error) throw error;
      } else {
        // Create new registration
        const { error } = await supabase.from("participants").insert({
          event_id: event.id,
          name: signupForm.name,
          email: signupForm.email,
          phone: signupForm.phone,
          notes: signupForm.notes,
          responses: signupForm.responses,
          user_id: user?.id || null,
        });

        if (error) throw error;
      }

      // Reset form and close drawer
      setSignupForm({
        name: "",
        email: "",
        phone: "",
        notes: "",
        responses: {},
      });
      setShowSignupDrawer(false);

      // Reload participants
      loadEventData();
    } catch (err: any) {
      setSignupError(
        err.message ||
          "Failed to " + (userRegistration ? "update registration" : "sign up"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmWithdraw = async () => {
    if (!userRegistration || !user) return;

    setSubmitting(true);
    setSignupError("");

    try {
      const { error } = await supabase
        .from("participants")
        .delete()
        .eq("id", userRegistration.id);

      if (error) throw error;

      // Reset form and close drawer
      setSignupForm({
        name: "",
        email: "",
        phone: "",
        notes: "",
        responses: {},
      });
      setShowSignupDrawer(false);
      setShowWithdrawDialog(false);

      // Reload participants
      loadEventData();
    } catch (err: any) {
      setSignupError(err.message || "Failed to withdraw from event");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.includes(searchQuery),
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Event not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-14">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center px-4 py-3">
          <button onClick={() => navigate("/events")} className="mr-3">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">{event.name}</h1>
            <p className="text-xs text-gray-500">
              {participants.length} participant
              {participants.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 pb-18">
        {/* Event Info */}
        {(event.description ||
          event.datetime ||
          event.location ||
          event.max_participants) && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-4 space-y-3">
              {/* Top row: Date and Participants */}
              {(event.datetime || event.max_participants) && (
                <div className="grid grid-cols-2 gap-4">
                  {event.datetime && (
                    <div className="text-sm text-gray-600">
                      <div className="font-medium text-gray-800">Date</div>
                      <div>{new Date(event.datetime).toLocaleString()}</div>
                    </div>
                  )}
                  {event.max_participants && (
                    <div className="text-sm text-gray-600">
                      <div className="font-medium text-gray-800">
                        Participants
                      </div>
                      <div>
                        {participants.length}/{event.max_participants}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Second row: Location */}
              {event.location && (
                <div className="text-sm text-gray-600">
                  <div className="font-medium text-gray-800">Location</div>
                  <div>{event.location}</div>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div className="text-sm text-gray-700">
                  <div className="font-medium text-gray-800 mb-1">
                    Description
                  </div>
                  <p className="leading-relaxed">{event.description}</p>
                </div>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div className="border-t bg-gray-50">
              <div className="flex divide-x divide-gray-200">
                <button
                  onClick={() => navigate(`/events/${eventId}/edit`)}
                  className="flex-1 flex items-center justify-center py-3 px-4 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </button>
                <button
                  onClick={shareEvent}
                  className="flex-1 flex items-center justify-center py-3 px-4 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </button>
                <button
                  onClick={exportToCSV}
                  className="flex-1 flex items-center justify-center py-3 px-4 text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Participants List */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-3 border-b bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Search participants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
            </div>
          </div>

          <div className="divide-y">
            {(() => {
              const maxSlots =
                event.max_participants || filteredParticipants.length;
              const slots = [];

              // Add existing participants to slots
              for (
                let i = 0;
                i < Math.min(filteredParticipants.length, maxSlots);
                i++
              ) {
                const participant = filteredParticipants[i];
                slots.push(
                  <button
                    key={participant.id}
                    onClick={() => setSelectedParticipant(participant)}
                    className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">
                            {participant.name}
                          </div>
                          {participant.user_id === event.organizer_id && (
                            <Badge variant="outline" className="text-xs h-5 px-2">
                              Organizer
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          Signed up {(() => {
                            const now = new Date();
                            const signupTime = new Date(participant.created_at);
                            const diffMs = now.getTime() - signupTime.getTime();
                            const diffMins = Math.floor(diffMs / (1000 * 60));
                            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                            if (diffMins < 60) {
                              return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
                            } else if (diffHours < 24) {
                              return `${diffHours}h ago`;
                            } else if (diffDays < 7) {
                              return `${diffDays}d ago`;
                            } else {
                              return `on ${signupTime.toLocaleDateString()}`;
                            }
                          })()}
                        </div>
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
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        #{i + 1}
                      </div>
                    </div>
                  </button>,
                );
              }

              // Add empty slots if we have max_participants set
              if (
                event.max_participants &&
                filteredParticipants.length < event.max_participants
              ) {
                for (
                  let i = filteredParticipants.length;
                  i < event.max_participants;
                  i++
                ) {
                  slots.push(
                    <div
                      key={`empty-${i}`}
                      className="p-3 border-dashed border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400 italic">
                          Available slot
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          #{i + 1}
                        </div>
                      </div>
                    </div>,
                  );
                }
              }

              if (slots.length === 0) {
                return (
                  <div className="p-6 text-center">
                    <Users className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">
                      {searchQuery
                        ? "No participants found"
                        : "No participants yet"}
                    </p>
                  </div>
                );
              }

              return slots;
            })()}
          </div>
        </div>
      </div>

      {/* Join Event Button above navbar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
        <Button
          onClick={openSignupDrawer}
          className={`w-full text-white shadow-lg ${
            userRegistration
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
          size="default"
        >
          {userRegistration ? (
            <>
              <UserCheck className="h-5 w-5 mr-2" />
              Modify Registration
            </>
          ) : (
            <>
              <UserPlus className="h-5 w-5 mr-2" />
              Join Event
            </>
          )}
        </Button>
      </div>

      {/* Signup Drawer */}
      <Drawer open={showSignupDrawer} onOpenChange={setShowSignupDrawer}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-center">
            <DrawerTitle>
              {userRegistration ? "Modify Registration for" : "Join"}{" "}
              {event?.name}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto flex-1 px-4">
            <form
              id="signup-form"
              onSubmit={handleSignup}
              className="space-y-4 pb-4"
            >
              <Tabs defaultValue="registration" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="registration">Registration</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                <TabsContent value="registration" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-xs">
                  Name *
                </Label>
                <Input
                  id="signup-name"
                  type="text"
                  value={signupForm.name}
                  onChange={(e) =>
                    setSignupForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  autoComplete="off"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-xs">
                  Email (optional)
                </Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={signupForm.email}
                  onChange={(e) =>
                    setSignupForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  autoComplete="off"
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-phone" className="text-xs">
                  Phone (optional)
                </Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  value={signupForm.phone}
                  onChange={(e) =>
                    setSignupForm((prev) => ({
                      ...prev,
                      phone: e.target.value,
                    }))
                  }
                  autoComplete="off"
                  className="h-9 text-sm"
                />
              </div>

              {event?.custom_fields && event.custom_fields.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">
                    Additional Information
                  </h3>
                  {event.custom_fields.map((field) => (
                    <div key={field.id} className="space-y-2 mb-4">
                      <Label htmlFor={`signup-${field.id}`} className="text-xs">
                        {field.label} {field.required && "*"}
                      </Label>
                      {field.type === "select" && field.options ? (
                        <Select
                          value={signupForm.responses[field.id] || ""}
                          onValueChange={(value) =>
                            setSignupForm((prev) => ({
                              ...prev,
                              responses: {
                                ...prev.responses,
                                [field.id]: value,
                              },
                            }))
                          }
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id={`signup-${field.id}`}
                          type={field.type}
                          value={signupForm.responses[field.id] || ""}
                          onChange={(e) =>
                            setSignupForm((prev) => ({
                              ...prev,
                              responses: {
                                ...prev.responses,
                                [field.id]: e.target.value,
                              },
                            }))
                          }
                          required={field.required}
                          autoComplete="off"
                          className="h-9 text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
                </TabsContent>

                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-notes" className="text-xs">
                      Notes (optional)
                    </Label>
                    <Textarea
                      id="signup-notes"
                      value={signupForm.notes}
                      onChange={(e) =>
                        setSignupForm((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder="Any additional notes or comments..."
                      className="min-h-[100px] text-sm"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {signupError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  {signupError}
                </div>
              )}
            </form>
          </div>
          <div className="border-t border-gray-200 my-4 -mx-4"></div>
          <DrawerFooter>
            <div className="flex gap-2 w-full">
              {userRegistration && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setShowWithdrawDialog(true)}
                  disabled={submitting}
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Withdraw
                </Button>
              )}
              <Button
                type="submit"
                form="signup-form"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={submitting}
              >
                {submitting
                  ? userRegistration
                    ? "Updating..."
                    : "Joining..."
                  : userRegistration
                    ? "Update Registration"
                    : "Join Event"}
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Participant Details Sheet */}
      <Sheet
        open={!!selectedParticipant}
        onOpenChange={(open) => !open && setSelectedParticipant(null)}
      >
        <SheetContent side="bottom" className="h-[80vh]">
          {selectedParticipant && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedParticipant.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Contact Information</h3>
                  <div className="text-sm space-y-1">
                    <div>
                      Email: {selectedParticipant.email || "Not provided"}
                    </div>
                    <div>
                      Phone: {selectedParticipant.phone || "Not provided"}
                    </div>
                    <div>
                      Registered:{" "}
                      {new Date(
                        selectedParticipant.created_at,
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>

                {event.custom_fields && event.custom_fields.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">
                      Additional Information
                    </h3>
                    <div className="text-sm space-y-1">
                      {event.custom_fields.map((field) => (
                        <div key={field.id}>
                          {field.label}:{" "}
                          {selectedParticipant.responses[field.id] ||
                            "Not provided"}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Labels</h3>
                  <div className="flex flex-wrap gap-2">
                    {labels.map((label) => {
                      const hasLabel = selectedParticipant.labels.some(
                        (l) => l.id === label.id,
                      );
                      return (
                        <button
                          key={label.id}
                          onClick={() =>
                            toggleParticipantLabel(selectedParticipant, label)
                          }
                          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                            hasLabel
                              ? "bg-primary text-white border-primary"
                              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {label.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Withdraw Confirmation Dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw from Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to withdraw from this event? This action cannot be undone and you'll need to register again if you change your mind.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowWithdrawDialog(false)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmWithdraw}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              {submitting ? "Withdrawing..." : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
