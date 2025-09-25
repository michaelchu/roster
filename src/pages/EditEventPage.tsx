import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Trash2, Minus, Save } from "lucide-react";

interface CustomField {
  id: string;
  label: string;
  type: "text" | "email" | "tel" | "number" | "select";
  required: boolean;
  options?: string[];
}

interface EventData {
  id: string;
  name: string;
  description: string | null;
  datetime: string | null;
  location: string | null;
  max_participants: number | null;
  custom_fields: CustomField[];
}

export function EditEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [event, setEvent] = useState<EventData | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    datetime: "",
    location: "",
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [maxParticipants, setMaxParticipants] = useState<number>(50);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (eventId && user) {
      loadEvent();
    }
  }, [eventId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEvent = async () => {
    if (!eventId) return;

    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId)
        .eq("organizer_id", user?.id)
        .single();

      if (error) throw error;

      setEvent(data);
      setFormData({
        name: data.name,
        description: data.description || "",
        datetime: data.datetime
          ? new Date(data.datetime).toISOString().slice(0, 16)
          : "",
        location: data.location || "",
      });
      setCustomFields(data.custom_fields || []);
      setMaxParticipants(data.max_participants || 50);
    } catch (error) {
      console.error("Error loading event:", error);
      navigate("/events");
    } finally {
      setInitialLoading(false);
    }
  };

  const incrementMaxParticipants = () => {
    setMaxParticipants((prev) => Math.min(prev + 1, 999));
  };

  const decrementMaxParticipants = () => {
    setMaxParticipants((prev) => Math.max(prev - 1, 1));
  };

  const handleMaxParticipantsChange = (value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= 999) {
      setMaxParticipants(num);
    }
  };

  const addCustomField = () => {
    const newField: CustomField = {
      id: Date.now().toString(),
      label: "",
      type: "text",
      required: false,
    };
    setCustomFields([...customFields, newField]);
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields(
      customFields.map((field) =>
        field.id === id ? { ...field, ...updates } : field,
      ),
    );
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter((field) => field.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          name: formData.name,
          description: formData.description || null,
          datetime: formData.datetime || null,
          location: formData.location || null,
          max_participants: maxParticipants,
          custom_fields: customFields.filter((f) => f.label),
        })
        .eq("id", event.id)
        .eq("organizer_id", user.id);

      if (error) throw error;
      navigate(`/events/${event.id}`);
    } catch (error) {
      console.error("Error updating event:", error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!event || !user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", event.id)
        .eq("organizer_id", user.id);

      if (error) throw error;
      navigate("/events");
    } catch (error) {
      console.error("Error deleting event:", error);
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading event...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Event Not Found</h1>
          <p className="text-sm text-gray-500">
            This event doesn't exist or you don't have permission to edit it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <button
            onClick={() => navigate(`/events/${event.id}`)}
            className="absolute left-4"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Edit Event</h1>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 px-3 text-xs absolute right-4"
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-lg p-4 border space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              Event Name *
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              required
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm">
              Description
            </Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full px-3 py-2 text-sm border rounded-md resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="datetime" className="text-sm">
              Date & Time
            </Label>
            <Input
              id="datetime"
              type="datetime-local"
              value={formData.datetime}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, datetime: e.target.value }))
              }
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm">
              Location
            </Label>
            <Input
              id="location"
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, location: e.target.value }))
              }
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Max Participants</Label>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0"
                onClick={decrementMaxParticipants}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={maxParticipants}
                onChange={(e) => handleMaxParticipantsChange(e.target.value)}
                className="h-10 text-sm text-center"
                min="1"
                max="999"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0"
                onClick={incrementMaxParticipants}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Custom Fields</h2>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={addCustomField}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Field
            </Button>
          </div>

          {customFields.length === 0 ? (
            <p className="text-xs text-gray-500">
              No custom fields. Add fields to collect additional information
              from participants.
            </p>
          ) : (
            <div className="space-y-3">
              {customFields.map((field) => (
                <div
                  key={field.id}
                  className="p-3 bg-gray-50 rounded space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={field.label}
                      onChange={(e) =>
                        updateCustomField(field.id, { label: e.target.value })
                      }
                      placeholder="Field label"
                      className="flex-1 h-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(field.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateCustomField(field.id, {
                          type: e.target.value as CustomField["type"],
                          options:
                            e.target.value === "select" ? [""] : undefined,
                        })
                      }
                      className="flex-1 h-9 px-2 text-sm border rounded"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                      <option value="number">Number</option>
                      <option value="select">Dropdown</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) =>
                          updateCustomField(field.id, {
                            required: e.target.checked,
                          })
                        }
                      />
                      Required
                    </label>
                  </div>
                  {field.type === "select" && (
                    <div className="space-y-2">
                      <Label className="text-xs">Options (one per line)</Label>
                      <textarea
                        value={field.options?.join("\n") || ""}
                        onChange={(e) =>
                          updateCustomField(field.id, {
                            options: e.target.value.split("\n").filter(Boolean),
                          })
                        }
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                        className="w-full px-2 py-1 text-sm border rounded resize-none"
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Save Changes Button above navbar */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
        <Button
          onClick={(e) => {
            e.preventDefault();
            handleSubmit(e as React.FormEvent);
          }}
          className="w-full text-white shadow-lg"
          size="sm"
          disabled={loading}
        >
          <Save className="h-5 w-5 mr-2" />
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? All participants and data will be permanently removed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? "Deleting..." : "Delete Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
