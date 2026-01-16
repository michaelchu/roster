import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Trash2, Lock, Unlock } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { eventService, groupService, type Group } from '@/services';
import { errorHandler, ValidationError } from '@/lib/errorHandler';
import { MaxParticipantsInput } from '@/components/MaxParticipantsInput';
import { useLoadingState } from '@/hooks/useLoadingState';
import { fromLocalInputValue } from '@/lib/utils';
import { DateTimeInput } from '@/components/DateTimeInput';

interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select';
  required: boolean;
  options?: string[];
}

export function NewEventPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    datetime: '',
    end_datetime: '',
    location: '',
    max_participants: null as number | null,
    is_private: false,
    group_id: '__no_group__',
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [maxParticipants, setMaxParticipants] = useState<number>(10);
  const {
    isLoading: groupsLoading,
    data: groups,
    execute: loadGroups,
  } = useLoadingState<Group[]>(null);

  const loadGroupsCallback = useCallback(async () => {
    if (!user) return [];
    return await groupService.getGroupsByOrganizer(user.id);
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadGroups(loadGroupsCallback);
    }
  }, [user, loadGroups, loadGroupsCallback]);

  useEffect(() => {
    const groupParam = searchParams.get('group');
    if (!groupParam) {
      return;
    }

    if (groupParam === '__no_group__') {
      setFormData((prev) =>
        prev.group_id === '__no_group__' ? prev : { ...prev, group_id: '__no_group__' }
      );
      return;
    }

    if (groupsLoading || groups === null) {
      return;
    }

    const nextGroupId = groups?.some((group) => group.id === groupParam)
      ? groupParam
      : '__no_group__';

    setFormData((prev) =>
      prev.group_id === nextGroupId ? prev : { ...prev, group_id: nextGroupId }
    );
  }, [searchParams, groupsLoading, groups]);

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
    if (!user) return;

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
      const eventData = await eventService.createEvent({
        organizer_id: user.id,
        name: formData.name,
        description: formData.description || null,
        datetime: formData.datetime ? fromLocalInputValue(formData.datetime) : null,
        end_datetime: formData.end_datetime ? fromLocalInputValue(formData.end_datetime) : null,
        location: formData.location || null,
        max_participants: maxParticipants,
        is_private: formData.is_private,
        custom_fields: customFields.filter((f) => f.label),
        parent_event_id: null,
        group_id: formData.group_id === '__no_group__' ? null : formData.group_id,
      });

      errorHandler.success(`Event "${eventData.name}" created successfully!`);
      navigate(`/signup/${eventData.id}`);
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'createEvent',
      });
    } finally {
      setLoading(false);
    }
  };

  // Get selected group name for header
  const selectedGroup = groups?.find((g) => g.id === formData.group_id);

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav showCloseButton sticky />

      <form id="create-event-form" onSubmit={handleSubmit} className="p-3 space-y-4">
        {/* Header when creating event for a group */}
        {selectedGroup && (
          <div className="pb-2 border-b">
            <h2 className="text-base font-semibold">Create an event for {selectedGroup.name}</h2>
          </div>
        )}
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

        <div className="space-y-2">
          <Label htmlFor="datetime" className="text-sm">
            Start Date & Time
          </Label>
          <DateTimeInput
            id="datetime"
            value={formData.datetime}
            onChange={(value) => setFormData((prev) => ({ ...prev, datetime: value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_datetime" className="text-sm">
            End Date & Time (Optional)
          </Label>
          <DateTimeInput
            id="end_datetime"
            value={formData.end_datetime}
            onChange={(value) => setFormData((prev) => ({ ...prev, end_datetime: value }))}
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

        <div className="space-y-2">
          <Label htmlFor="group" className="text-sm">
            Group (Optional)
          </Label>
          <Select
            value={formData.group_id}
            onValueChange={(value) => setFormData((prev) => ({ ...prev, group_id: value }))}
            disabled={groupsLoading}
          >
            <SelectTrigger id="group" className="h-10 text-sm">
              <SelectValue placeholder="No group (standalone event)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__no_group__">No group (standalone event)</SelectItem>
              {groupsLoading ? (
                <SelectItem value="__loading__" disabled>
                  Loading groups...
                </SelectItem>
              ) : (
                groups?.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Assign this event to a group to organize related events together
          </p>
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

        <div className="pt-3 border-t">
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
            <p className="text-xs text-muted-foreground mt-2">
              No custom fields. Add fields to collect additional information from participants.
            </p>
          ) : (
            <div className="space-y-3 mt-3">
              {customFields.map((field) => (
                <div key={field.id} className="p-3 bg-muted rounded border space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
                      placeholder="Field label"
                      className="flex-1 h-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomField(field.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={field.type}
                      onValueChange={(value) =>
                        updateCustomField(field.id, {
                          type: value as CustomField['type'],
                          options: value === 'select' ? [''] : undefined,
                        })
                      }
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

        {/* Create Event Button */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
        >
          {loading ? 'Creating...' : 'Create Event'}
        </Button>
      </form>
    </div>
  );
}
