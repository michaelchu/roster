import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { Plus, Trash2, Lock, Unlock, X } from 'lucide-react';
import { FullScreenDrawer } from '@/components/ui/full-screen-drawer';
import {
  eventService,
  groupService,
  participantService,
  type Group,
  type GroupParticipant,
} from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import { MaxParticipantsInput } from '@/components/MaxParticipantsInput';
import { useLoadingState } from '@/hooks/useLoadingState';
import { fromLocalInputValue } from '@/lib/utils';
import { DateTimeInput } from '@/components/DateTimeInput';
import { showFormErrors } from '@/lib/formUtils';
import { newEventFormSchema, type NewEventFormData } from '@/lib/validation';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/UserAvatar';

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
  const { groupId: groupIdFromParams } = useParams<{ groupId: string }>();
  const { user, loading: authLoading } = useAuth();
  const showEventPrivacy = useFeatureFlag('event_privacy');
  const showRegistrationForm = useFeatureFlag('registration_form');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<NewEventFormData>({
    resolver: zodResolver(newEventFormSchema),
    defaultValues: {
      name: '',
      description: '',
      datetime: '',
      end_datetime: '',
      location: '',
      is_private: false,
      group_id: '__no_group__',
      datetimeTbd: false,
      endDatetimeTbd: false,
      locationTbd: false,
    },
  });

  const formData = watch();
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [maxParticipants, setMaxParticipants] = useState<number>(10);
  // Store previous values when TBD is checked so we can restore them
  const [previousValues, setPreviousValues] = useState({
    datetime: '',
    end_datetime: '',
    location: '',
  });
  const {
    isLoading: groupsLoading,
    data: groups,
    execute: loadGroups,
  } = useLoadingState<Group[]>(null);

  // Member selection state
  const [groupMembers, setGroupMembers] = useState<GroupParticipant[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [includeOrganizer, setIncludeOrganizer] = useState(true);
  const memberInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    // Priority: URL param > query param
    const groupParam = groupIdFromParams || searchParams.get('group');
    if (!groupParam) {
      return;
    }

    if (groupParam === '__no_group__') {
      if (formData.group_id !== '__no_group__') {
        setValue('group_id', '__no_group__');
      }
      return;
    }

    if (groupsLoading || groups === null) {
      return;
    }

    const nextGroupId = groups?.some((group) => group.id === groupParam)
      ? groupParam
      : '__no_group__';

    if (formData.group_id !== nextGroupId) {
      setValue('group_id', nextGroupId);
    }
  }, [groupIdFromParams, searchParams, groupsLoading, groups, formData.group_id, setValue]);

  // Load group members when group changes
  useEffect(() => {
    const loadGroupMembers = async () => {
      if (formData.group_id && formData.group_id !== '__no_group__') {
        try {
          const members = await groupService.getGroupParticipants(formData.group_id);
          setGroupMembers(members);
        } catch (error) {
          errorHandler.handle(error, { action: 'load group members' });
          setGroupMembers([]);
        }
      } else {
        setGroupMembers([]);
      }
      // Reset selected members when group changes
      setSelectedMembers([]);
      setMemberSearchQuery('');
    };
    void loadGroupMembers();
  }, [formData.group_id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        memberInputRef.current &&
        !memberInputRef.current.contains(event.target as Node)
      ) {
        setShowMemberDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter members based on search query, excluding the organizer (they have their own checkbox)
  const filteredMembers = groupMembers.filter(
    (member) =>
      member.id !== user?.id &&
      !selectedMembers.some((s) => s.id === member.id) &&
      member.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  const selectMember = (member: GroupParticipant) => {
    setSelectedMembers([...selectedMembers, { id: member.id, name: member.name }]);
    setMemberSearchQuery('');
    setShowMemberDropdown(false);
  };

  const removeMember = (memberId: string) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== memberId));
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

  const onSubmit = async (data: NewEventFormData) => {
    if (!user) return;

    // Client-side validation for past dates
    const now = new Date();
    if (data.datetime) {
      const startDate = new Date(data.datetime);
      if (startDate < now) {
        toast.error('Start date cannot be in the past');
        return;
      }
    }

    if (data.end_datetime) {
      const endDate = new Date(data.end_datetime);
      if (endDate < now) {
        toast.error('End date cannot be in the past');
        return;
      }
    }

    // Client-side validation for end date
    if (data.datetime && data.end_datetime) {
      const startDate = new Date(data.datetime);
      const endDate = new Date(data.end_datetime);
      if (endDate <= startDate) {
        toast.error('End date must be after start date');
        return;
      }
    }

    try {
      const eventData = await eventService.createEvent({
        organizer_id: user.id,
        name: data.name,
        description: data.description || null,
        datetime: data.datetime ? fromLocalInputValue(data.datetime) : null,
        end_datetime: data.end_datetime ? fromLocalInputValue(data.end_datetime) : null,
        location: data.location || null,
        max_participants: maxParticipants,
        is_private: data.is_private,
        custom_fields: customFields.filter((f) => f.label),
        parent_event_id: null,
        group_id: data.group_id === '__no_group__' ? null : data.group_id,
      });

      // Add organizer (if checkbox checked) and selected members as participants
      const membersToAdd = [...selectedMembers.map((m) => ({ name: m.name, user_id: m.id }))];
      if (includeOrganizer) {
        const organizerName = user.user_metadata?.full_name || user.email || 'Organizer';
        membersToAdd.unshift({ name: organizerName, user_id: user.id });
      }

      if (membersToAdd.length > 0) {
        const { created, failed, duplicates } = await participantService.createParticipantsBatch(
          eventData.id,
          membersToAdd
        );
        if (duplicates.length > 0) {
          toast.error(`${duplicates.join(', ')} already registered for this event`);
        } else if (failed > 0) {
          toast.warning(`Added ${created} participants, ${failed} failed`);
        }
      }

      errorHandler.success(`Event "${eventData.name}" created successfully!`);
      navigate(`/signup/${eventData.id}`);
    } catch (error) {
      errorHandler.handle(error, {
        userId: user.id,
        action: 'createEvent',
      });
    }
  };

  // Get selected group name for header
  const selectedGroup = groups?.find((g) => g.id === formData.group_id);

  const handleClose = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/events');
    }
  };

  return (
    <FullScreenDrawer open={true} onOpenChange={(open) => !open && handleClose()}>
      <form
        id="create-event-form"
        onSubmit={handleSubmit(onSubmit, showFormErrors)}
        className="flex-1 overflow-y-auto p-3 space-y-4 bg-background"
      >
        {/* Header when creating event for a group */}
        {selectedGroup && (
          <div className="pb-3 border-b">
            <h2 className="text-base font-semibold break-words">{selectedGroup.name}</h2>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm">
            Event Name *
          </Label>
          <Input
            {...register('name')}
            id="name"
            type="text"
            className="h-10 text-sm"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm">
            Description
          </Label>
          <Textarea
            {...register('description')}
            id="description"
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
                    setPreviousValues((prev) => ({ ...prev, datetime: formData.datetime || '' }));
                    setValue('datetimeTbd', true);
                    setValue('datetime', '');
                  } else {
                    setValue('datetimeTbd', false);
                    setValue('datetime', previousValues.datetime);
                  }
                }}
              />
              TBD
            </label>
          </div>
          <DateTimeInput
            id="datetime"
            value={formData.datetime || ''}
            onChange={(value) => setValue('datetime', value)}
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
                      end_datetime: formData.end_datetime || '',
                    }));
                    setValue('endDatetimeTbd', true);
                    setValue('end_datetime', '');
                  } else {
                    setValue('endDatetimeTbd', false);
                    setValue('end_datetime', previousValues.end_datetime);
                  }
                }}
              />
              TBD
            </label>
          </div>
          <DateTimeInput
            id="end_datetime"
            value={formData.end_datetime || ''}
            onChange={(value) => setValue('end_datetime', value)}
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
                    setPreviousValues((prev) => ({ ...prev, location: formData.location || '' }));
                    setValue('locationTbd', true);
                    setValue('location', '');
                  } else {
                    setValue('locationTbd', false);
                    setValue('location', previousValues.location);
                  }
                }}
              />
              TBD
            </label>
          </div>
          <Input
            {...register('location')}
            id="location"
            type="text"
            value={formData.locationTbd ? '' : formData.location || ''}
            className="h-10 text-sm"
            disabled={formData.locationTbd}
            placeholder={formData.locationTbd ? 'TBD' : ''}
          />
        </div>

        <div className="border-t" />

        <div className="space-y-2">
          <Label htmlFor="group" className="text-sm">
            Group
          </Label>
          <Select
            value={formData.group_id}
            onValueChange={(value) => setValue('group_id', value)}
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

        {/* Participant selection */}
        <div className="space-y-2">
          <Label className="text-sm">Add Participants (Optional)</Label>

          {/* Include organizer checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeOrganizer"
              checked={includeOrganizer}
              onCheckedChange={(checked) => setIncludeOrganizer(checked === true)}
            />
            <label
              htmlFor="includeOrganizer"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Include myself as participant
            </label>
          </div>

          {/* Member selection - only show when group is selected */}
          {formData.group_id && formData.group_id !== '__no_group__' && (
            <>
              {/* Autocomplete Input */}
              <div className="relative">
                <Input
                  ref={memberInputRef}
                  placeholder="Type to search members..."
                  value={memberSearchQuery}
                  onChange={(e) => {
                    setMemberSearchQuery(e.target.value);
                    setShowMemberDropdown(true);
                  }}
                  onFocus={() => setShowMemberDropdown(true)}
                  className="h-10 text-sm"
                  autoComplete="off"
                />

                {/* Dropdown with filtered results */}
                {showMemberDropdown && memberSearchQuery && filteredMembers.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto"
                  >
                    {filteredMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => selectMember(member)}
                        className="w-full p-2 hover:bg-muted flex items-center gap-2 text-left"
                      >
                        <UserAvatar name={member.name} avatarUrl={member.avatar_url} size="sm" />
                        <span className="text-sm">{member.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {showMemberDropdown && memberSearchQuery && filteredMembers.length === 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md p-3"
                  >
                    <p className="text-sm text-muted-foreground">No members found</p>
                  </div>
                )}
              </div>

              {/* Selected members as chips */}
              {selectedMembers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMembers.map((member) => (
                    <Badge
                      key={member.id}
                      variant="outline"
                      className="gap-1 pr-1 border-pink-500 text-pink-600"
                    >
                      {member.name}
                      <button
                        type="button"
                        onClick={() => removeMember(member.id)}
                        className="ml-1 hover:bg-pink-100 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Selected members will be added as participants when the event is created
              </p>
            </>
          )}
        </div>

        <div className="border-t" />

        <MaxParticipantsInput value={maxParticipants} onChange={setMaxParticipants} />

        {showEventPrivacy && (
          <div className="space-y-2">
            <Label className="text-sm">Event Privacy</Label>
            <button
              type="button"
              onClick={() => setValue('is_private', !formData.is_private)}
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
          </>
        )}

        {/* Create Event Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
        >
          {isSubmitting ? (
            'Creating...'
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </>
          )}
        </Button>
      </form>
    </FullScreenDrawer>
  );
}
