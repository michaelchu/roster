import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useCustomFields } from '@/hooks/useCustomFields';
import { Trash2, Save } from 'lucide-react';
import { FullScreenDrawer } from '@/components/ui/full-screen-drawer';
import { eventService } from '@/services';
import { errorHandler, ValidationError } from '@/lib/errorHandler';
import { EditEventPageSkeleton } from '@/components/EditEventPageSkeleton';
import { MaxParticipantsInput } from '@/components/MaxParticipantsInput';
import { toLocalInputValue, fromLocalInputValue } from '@/lib/utils';
import { CustomFieldsEditor } from '@/components/CustomFieldsEditor';
import { PrivacyToggle } from '@/components/PrivacyToggle';
import { TbdDateTimeField } from '@/components/TbdDateTimeField';
import { Checkbox } from '@/components/ui/checkbox';
import type { CustomField } from '@/types/app.types';

interface EventData {
  id: string;
  name: string;
  description: string | null;
  datetime: string | null;
  end_datetime: string | null;
  location: string | null;
  max_participants: number | null;
  is_paid: boolean;
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
    is_paid: true,
    is_private: false,
    datetimeTbd: false,
    endDatetimeTbd: false,
    locationTbd: false,
  });
  const { customFields, addCustomField, updateCustomField, removeCustomField, resetCustomFields } =
    useCustomFields();
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
        is_paid: data.is_paid ?? true,
        is_private: data.is_private ?? false,
        datetimeTbd: !data.datetime,
        endDatetimeTbd: !data.end_datetime,
        locationTbd: !data.location,
      });
      resetCustomFields(data.custom_fields || []);
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
        is_paid: formData.is_paid,
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

  const handleClose = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/events');
    }
  };

  if (initialLoading) {
    return (
      <FullScreenDrawer open={true} onOpenChange={(open) => !open && handleClose()}>
        <EditEventPageSkeleton />
      </FullScreenDrawer>
    );
  }

  if (!event) {
    return (
      <FullScreenDrawer open={true} onOpenChange={(open) => !open && handleClose()}>
        <div className="flex-1 bg-background flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-lg font-semibold mb-2">Event Not Found</h1>
            <p className="text-sm text-muted-foreground">
              This event doesn't exist or you don't have permission to edit it.
            </p>
          </div>
        </div>
      </FullScreenDrawer>
    );
  }

  return (
    <FullScreenDrawer open={true} onOpenChange={(open) => !open && handleClose()}>
      <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-background">
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

        <TbdDateTimeField
          id="datetime"
          label="Start Date & Time"
          value={formData.datetime}
          isTbd={formData.datetimeTbd}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, datetime: value }))}
          onTbdChange={(isTbd, prevValue) => {
            if (isTbd) {
              setPreviousValues((prev) => ({ ...prev, datetime: prevValue }));
              setFormData((prev) => ({ ...prev, datetimeTbd: true, datetime: '' }));
            } else {
              setFormData((prev) => ({
                ...prev,
                datetimeTbd: false,
                datetime: previousValues.datetime,
              }));
            }
          }}
          type="datetime"
        />

        <TbdDateTimeField
          id="end_datetime"
          label="End Date & Time"
          value={formData.end_datetime}
          isTbd={formData.endDatetimeTbd}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, end_datetime: value }))}
          onTbdChange={(isTbd, prevValue) => {
            if (isTbd) {
              setPreviousValues((prev) => ({ ...prev, end_datetime: prevValue }));
              setFormData((prev) => ({ ...prev, endDatetimeTbd: true, end_datetime: '' }));
            } else {
              setFormData((prev) => ({
                ...prev,
                endDatetimeTbd: false,
                end_datetime: previousValues.end_datetime,
              }));
            }
          }}
          type="datetime"
        />

        <TbdDateTimeField
          id="location"
          label="Location"
          value={formData.location}
          isTbd={formData.locationTbd}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, location: value }))}
          onTbdChange={(isTbd, prevValue) => {
            if (isTbd) {
              setPreviousValues((prev) => ({ ...prev, location: prevValue }));
              setFormData((prev) => ({ ...prev, locationTbd: true, location: '' }));
            } else {
              setFormData((prev) => ({
                ...prev,
                locationTbd: false,
                location: previousValues.location,
              }));
            }
          }}
          type="text"
        />

        <div className="border-t" />

        <MaxParticipantsInput value={maxParticipants} onChange={setMaxParticipants} />

        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_paid"
            checked={formData.is_paid}
            onCheckedChange={(checked) =>
              setFormData((prev) => ({ ...prev, is_paid: checked === true }))
            }
          />
          <label htmlFor="is_paid" className="text-sm cursor-pointer">
            Paid event
          </label>
        </div>

        {showEventPrivacy && (
          <PrivacyToggle
            isPrivate={formData.is_private}
            onChange={(isPrivate) => setFormData((prev) => ({ ...prev, is_private: isPrivate }))}
          />
        )}

        {showRegistrationForm && (
          <>
            <div className="border-t" />
            <CustomFieldsEditor
              customFields={customFields}
              onAdd={addCustomField}
              onUpdate={updateCustomField}
              onRemove={removeCustomField}
            />
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
    </FullScreenDrawer>
  );
}
