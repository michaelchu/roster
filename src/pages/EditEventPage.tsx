import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { Plus, Trash2, Save, Lock, Unlock } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { eventService } from '@/services';
import { errorHandler, ValidationError } from '@/lib/errorHandler';
import { EditEventPageSkeleton } from '@/components/EditEventPageSkeleton';
import { MaxParticipantsInput } from '@/components/MaxParticipantsInput';
import { toLocalInputValue, fromLocalInputValue } from '@/lib/utils';
import { DateTimeInput } from '@/components/DateTimeInput';

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
  end_datetime: string | null;
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
  const showEventPrivacy = useFeatureFlag('event_privacy');
  const showRegistrationForm = useFeatureFlag('registration_form');
  const [initialLoading, setInitialLoading] = useState(true);
  const [event, setEvent] = useState<EventData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    datetime: '',
    end_datetime: '',
    location: '',
    is_private: false,
    datetimeTbd: false,
    endDatetimeTbd: false,
    locationTbd: false,
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [maxParticipants, setMaxParticipants] = useState<number>(10);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Store previous values when TBD is checked so we can restore them
  const [previousValues, setPreviousValues] = useState({
    datetime: '',
    end_datetime: '',
    location: '',
  });

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
        datetime: data.datetime ? toLocalInputValue(data.datetime) : '',
        end_datetime: data.end_datetime ? toLocalInputValue(data.end_datetime) : '',
        location: data.location || '',
        is_private: data.is_private ?? false,
        datetimeTbd: !data.datetime,
        endDatetimeTbd: !data.end_datetime,
        locationTbd: !data.location,
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

  const saveChanges = async () => {
    if (!event || !user) return;

    // Validate event name
    if (!formData.name.trim()) {
      errorHandler.handle(
        new ValidationError('Event name validation failed', 'Event name is required'),
        {
          userId: user.id,
          action: 'validateEventName',
        }
      );
      return;
    }

    // Client-side validation for past dates
    const now = new Date();
    if (formData.datetime) {
      const startDate = new Date(formData.datetime);
      if (startDate < now) {
        errorHandler.handle(
          new ValidationError('Start date validation failed', 'Start date cannot be in the past'),
          {
            userId: user.id,
            action: 'validateEventDates',
          }
        );
        return;
      }
    }

    if (formData.end_datetime) {
      const endDate = new Date(formData.end_datetime);
      if (endDate < now) {
        errorHandler.handle(
          new ValidationError('End date validation failed', 'End date cannot be in the past'),
          {
            userId: user.id,
            action: 'validateEventDates',
          }
        );
        return;
      }
    }

    // Client-side validation for end date
    if (formData.datetime && formData.end_datetime) {
      const startDate = new Date(formData.datetime);
      const endDate = new Date(formData.end_datetime);
      if (endDate <= startDate) {
        errorHandler.handle(
          new ValidationError('Date range validation failed', 'End date must be after start date'),
          {
            userId: user.id,
            action: 'validateEventDates',
          }
        );
        return;
      }
    }

    setLoading(true);
    try {
      await eventService.updateEvent(event.id, {
        name: formData.name,
        description: formData.description || null,
        datetime: formData.datetime ? fromLocalInputValue(formData.datetime) : null,
        end_datetime: formData.end_datetime ? fromLocalInputValue(formData.end_datetime) : null,
        location: formData.location || null,
        max_participants: maxParticipants,
        is_private: formData.is_private,
        custom_fields: customFields
          .filter((f) => f.label)
          .map((f) => ({
            ...f,
            options: f.type === 'select' ? f.options : undefined,
          })),
      });

      errorHandler.success('Event updated successfully!');
      navigate(`/signup/${event.id}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : String(error);
      if (errorMessage.includes('Cannot reduce capacity')) {
        errorHandler.info(
          'Cannot reduce capacity below current registrations. Remove some participants first.'
        );
      } else {
        errorHandler.handle(error, {
          userId: user.id,
          action: 'updateEvent',
          metadata: { eventId: event.id },
        });
      }
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
    <div className="min-h-screen bg-background pb-20">
      <TopNav showCloseButton sticky />

      <div className="p-3 space-y-4">
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
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm">
            Description
          </Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            className="text-sm resize-none"
            rows={3}
          />
        </div>

        <div className="border-t" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="datetime" className="text-sm">
              Start Date & Time
            </Label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox
                checked={formData.datetimeTbd}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setPreviousValues((prev) => ({ ...prev, datetime: formData.datetime }));
                    setFormData((prev) => ({ ...prev, datetimeTbd: true, datetime: '' }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      datetimeTbd: false,
                      datetime: previousValues.datetime,
                    }));
                  }
                }}
              />
              TBD
            </label>
          </div>
          <DateTimeInput
            id="datetime"
            value={formData.datetime}
            onChange={(value) => setFormData((prev) => ({ ...prev, datetime: value }))}
            disabled={formData.datetimeTbd}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="end_datetime" className="text-sm">
              End Date & Time
            </Label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox
                checked={formData.endDatetimeTbd}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setPreviousValues((prev) => ({
                      ...prev,
                      end_datetime: formData.end_datetime,
                    }));
                    setFormData((prev) => ({ ...prev, endDatetimeTbd: true, end_datetime: '' }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      endDatetimeTbd: false,
                      end_datetime: previousValues.end_datetime,
                    }));
                  }
                }}
              />
              TBD
            </label>
          </div>
          <DateTimeInput
            id="end_datetime"
            value={formData.end_datetime}
            onChange={(value) => setFormData((prev) => ({ ...prev, end_datetime: value }))}
            disabled={formData.endDatetimeTbd}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="location" className="text-sm">
              Location
            </Label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <Checkbox
                checked={formData.locationTbd}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setPreviousValues((prev) => ({ ...prev, location: formData.location }));
                    setFormData((prev) => ({ ...prev, locationTbd: true, location: '' }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      locationTbd: false,
                      location: previousValues.location,
                    }));
                  }
                }}
              />
              TBD
            </label>
          </div>
          <Input
            id="location"
            type="text"
            value={formData.locationTbd ? '' : formData.location}
            onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
            className="h-10 text-sm"
            disabled={formData.locationTbd}
            placeholder={formData.locationTbd ? 'TBD' : ''}
          />
        </div>

        <div className="border-t" />

        <MaxParticipantsInput value={maxParticipants} onChange={setMaxParticipants} />

        {showEventPrivacy && (
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
              className={`flex items-center justify-between w-full p-2 rounded-lg border-2 transition-colors ${
                formData.is_private
                  ? 'border-destructive/20 bg-destructive/5'
                  : 'border-primary/20 bg-primary/5'
              }`}
            >
              <div className="flex items-center space-x-2">
                {formData.is_private ? (
                  <Lock className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <Unlock className="h-3.5 w-3.5 text-primary" />
                )}
                <span
                  className={`text-sm font-medium ${
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
        )}

        {showRegistrationForm && (
          <>
            <div className="border-t" />
            <div>
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

              {customFields.length > 0 && (
                <div className="space-y-3 mt-3">
                  {customFields.map((field) => (
                    <div key={field.id} className="p-3 bg-muted rounded border space-y-2">
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
                        <Select
                          value={field.type}
                          onValueChange={(value) => {
                            if (!field.id) return;
                            const nextType = value as CustomField['type'];
                            updateCustomField(field.id, {
                              type: nextType,
                              ...(nextType === 'select'
                                ? {
                                    options:
                                      field.options && field.options.length > 0
                                        ? field.options
                                        : [''],
                                  }
                                : field.type === 'select'
                                  ? { options: field.options }
                                  : {}),
                            });
                          }}
                        >
                          <SelectTrigger className="flex-1 h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="tel">Phone</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="select">Dropdown</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={field.required}
                            onCheckedChange={(checked) =>
                              field.id &&
                              updateCustomField(field.id, {
                                required: checked === true,
                              })
                            }
                          />
                          Required
                        </label>
                      </div>
                      {field.type === 'select' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Options (one per line)</Label>
                          <Textarea
                            value={field.options?.join('\n') || ''}
                            onChange={(e) =>
                              field.id &&
                              updateCustomField(field.id, {
                                options: e.target.value.split('\n').filter(Boolean),
                              })
                            }
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                            className="text-sm resize-none"
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Delete Event Button */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => setShowDeleteDialog(true)}
          disabled={loading}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Event
        </Button>

        {/* Save Changes Button */}
        <Button
          onClick={saveChanges}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : 'Save Changes'}
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
