import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, Save, Lock, Unlock } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { eventService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { LoadingSpinner } from '@/components/LoadingStates';
import { EditEventPageSkeleton } from '@/components/EditEventPageSkeleton';
import { MaxParticipantsInput } from '@/components/MaxParticipantsInput';

interface CustomField {
  id?: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select';
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
  is_private: boolean | null;
  custom_fields: CustomField[];
}

/**
 * Render the Edit Event page for an event organizer to view and modify an event.
 *
 * The page loads event data, verifies ownership, and provides controls to edit
 * name, description, date/time, location, max participants, privacy, and custom
 * participant fields. It also supports saving updates and permanently deleting
 * the event, with loading states and error handling.
 *
 * @returns The rendered Edit Event page as JSX
 */
export function EditEventPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [event, setEvent] = useState<EventData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    datetime: '',
    location: '',
    is_private: false,
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [maxParticipants, setMaxParticipants] = useState<number>(10);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    if (eventId && user) {
      loadEvent();
    }
  }, [eventId, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEvent = async () => {
    if (!eventId || !user) return;

    try {
      const data = await eventService.getEventById(eventId);

      // Verify ownership
      if (data.organizer_id !== user.id) {
        errorHandler.handle(new Error('Unauthorized'), {
          userId: user.id,
          action: 'loadEventForEdit',
        });
        navigate('/events');
        return;
      }

      setEvent({
        ...data,
        custom_fields: data.custom_fields || [],
      });
      setFormData({
        name: data.name,
        description: data.description || '',
        datetime: data.datetime ? new Date(data.datetime).toISOString().slice(0, 16) : '',
        location: data.location || '',
        is_private: data.is_private ?? false,
      });
      setCustomFields(data.custom_fields || []);
      setMaxParticipants(data.max_participants || 10);
    } catch (error) {
      errorHandler.handle(error, {
        userId: user?.id,
        action: 'loadEventForEdit',
      });
      navigate('/events');
    } finally {
      setInitialLoading(false);
    }
  };

  const addCustomField = () => {
    const newField: CustomField = {
      id: Date.now().toString(),
      label: '',
      type: 'text',
      required: false,
    };
    setCustomFields([...customFields, newField]);
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields(
      customFields.map((field) => (field.id === id ? { ...field, ...updates } : field))
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
      await eventService.updateEvent(event.id, {
        name: formData.name,
        description: formData.description || null,
        datetime: formData.datetime || null,
        location: formData.location || null,
        max_participants: maxParticipants,
        is_private: formData.is_private,
        custom_fields: customFields.filter((f) => f.label),
      });

      errorHandler.success('Event updated successfully!');
      navigate(`/signup/${event.id}`);
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'updateEvent',
        metadata: { eventId: event.id },
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!event || !user) return;

    setLoading(true);
    try {
      await eventService.deleteEvent(event.id);

      errorHandler.success('Event deleted successfully');
      navigate('/events');
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'deleteEvent',
        metadata: { eventId: event.id, eventName: event.name },
      });
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  if (initialLoading) {
    return <EditEventPageSkeleton />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Event Not Found</h1>
          <p className="text-sm text-muted-foreground">
            This event doesn't exist or you don't have permission to edit it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <TopNav title="Edit Event" showBackButton backPath={`/signup/${event.id}`} sticky />

      <div className="p-3 space-y-3">
        <div className="bg-card rounded-lg p-3 border space-y-3">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm">
              Event Name *
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, datetime: e.target.value }))}
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
              onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
              className="h-10 text-sm"
            />
          </div>

          <MaxParticipantsInput value={maxParticipants} onChange={setMaxParticipants} />

          <div className="space-y-2">
            <Label className="text-sm">Event Privacy</Label>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  is_private: !prev.is_private,
                }))
              }
              className={`flex items-center justify-between w-full p-3 rounded-lg border-2 transition-colors ${
                formData.is_private
                  ? 'border-destructive/20 bg-destructive/5'
                  : 'border-primary/20 bg-primary/5'
              }`}
            >
              <div className="flex items-center space-x-2">
                {formData.is_private ? (
                  <Lock className="h-4 w-4 text-destructive" />
                ) : (
                  <Unlock className="h-4 w-4 text-primary" />
                )}
                <span
                  className={`font-medium ${
                    formData.is_private ? 'text-destructive' : 'text-primary'
                  }`}
                >
                  {formData.is_private ? 'Private Event' : 'Public Event'}
                </span>
              </div>
            </button>
            <p className="text-xs text-muted-foreground">
              {formData.is_private
                ? 'Only people you invite can view and sign up for this event'
                : 'Anyone with the link can view and sign up for this event'}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-lg p-3 border space-y-3">
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
            <p className="text-xs text-muted-foreground">
              No custom fields. Add fields to collect additional information from participants.
            </p>
          ) : (
            <div className="space-y-3">
              {customFields.map((field) => (
                <div key={field.id} className="p-3 bg-muted rounded space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={field.label}
                      onChange={(e) =>
                        field.id && updateCustomField(field.id, { label: e.target.value })
                      }
                      placeholder="Field label"
                      className="flex-1 h-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => field.id && removeCustomField(field.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={field.type}
                      onChange={(e) =>
                        field.id &&
                        updateCustomField(field.id, {
                          type: e.target.value as CustomField['type'],
                          options: e.target.value === 'select' ? [''] : undefined,
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
                          field.id &&
                          updateCustomField(field.id, {
                            required: e.target.checked,
                          })
                        }
                      />
                      Required
                    </label>
                  </div>
                  {field.type === 'select' && (
                    <div className="space-y-2">
                      <Label className="text-xs">Options (one per line)</Label>
                      <textarea
                        value={field.options?.join('\n') || ''}
                        onChange={(e) =>
                          field.id &&
                          updateCustomField(field.id, {
                            options: e.target.value.split('\n').filter(Boolean),
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

        {/* Delete Event Button */}
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => setShowDeleteDialog(true)}
          disabled={loading}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Event
        </Button>
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
          {loading ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this event? All participants and data will be
              permanently removed. This action cannot be undone.
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
              {loading ? 'Deleting...' : 'Delete Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
