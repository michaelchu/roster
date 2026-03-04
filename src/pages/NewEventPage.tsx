import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
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
import { Plus, X } from 'lucide-react';
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
import { useCustomFields } from '@/hooks/useCustomFields';
import { fromLocalInputValue, getUserDisplayName } from '@/lib/utils';
import { showFormErrors } from '@/lib/formUtils';
import { newEventFormSchema, type NewEventFormData } from '@/lib/validation';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/UserAvatar';
import { CustomFieldsEditor } from '@/components/CustomFieldsEditor';
import { PrivacyToggle } from '@/components/PrivacyToggle';
import { TbdDateTimeField } from '@/components/TbdDateTimeField';

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
    control,
    formState: { isSubmitting },
  } = useForm<NewEventFormData>({
    resolver: zodResolver(newEventFormSchema),
    defaultValues: {
      name: '',
      description: '',
      datetime: '',
      end_datetime: '',
      location: '',
      is_paid: true,
      is_private: false,
      group_id: '__no_group__',
      datetimeTbd: false,
      endDatetimeTbd: false,
      locationTbd: false,
    },
  });

  const formData = watch();
  const { customFields, addCustomField, updateCustomField, removeCustomField } = useCustomFields();
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
        is_paid: data.is_paid,
        is_private: data.is_private,
        custom_fields: customFields.filter((f) => f.label),
        parent_event_id: null,
        group_id: data.group_id === '__no_group__' ? null : data.group_id,
      });

      // Add organizer (if checkbox checked) and selected members as participants
      const membersToAdd = [...selectedMembers.map((m) => ({ name: m.name, user_id: m.id }))];
      if (includeOrganizer) {
        const organizerName = getUserDisplayName(user, user.email || 'Organizer');
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
      navigate(`/signup/${eventData.id}`, { replace: true });
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
      navigate(groupIdFromParams ? `/groups/${groupIdFromParams}` : '/events');
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

        <TbdDateTimeField
          id="datetime"
          label="Start Date & Time"
          value={formData.datetime || ''}
          isTbd={formData.datetimeTbd}
          onValueChange={(value) => {
            setValue('datetime', value);
            if (
              value &&
              !formData.endDatetimeTbd &&
              (!formData.end_datetime || value >= formData.end_datetime)
            ) {
              setValue('end_datetime', value);
            }
          }}
          onTbdChange={(isTbd, prevValue) => {
            if (isTbd) {
              setPreviousValues((prev) => ({ ...prev, datetime: prevValue }));
              setValue('datetimeTbd', true);
              setValue('datetime', '');
            } else {
              setValue('datetimeTbd', false);
              setValue('datetime', previousValues.datetime);
            }
          }}
          type="datetime"
        />

        <TbdDateTimeField
          id="end_datetime"
          label="End Date & Time"
          value={formData.end_datetime || ''}
          isTbd={formData.endDatetimeTbd}
          onValueChange={(value) => setValue('end_datetime', value)}
          onTbdChange={(isTbd, prevValue) => {
            if (isTbd) {
              setPreviousValues((prev) => ({ ...prev, end_datetime: prevValue }));
              setValue('endDatetimeTbd', true);
              setValue('end_datetime', '');
            } else {
              setValue('endDatetimeTbd', false);
              setValue('end_datetime', previousValues.end_datetime);
            }
          }}
          type="datetime"
          error={
            !!(
              formData.datetime &&
              formData.end_datetime &&
              formData.end_datetime <= formData.datetime
            )
          }
        />

        <TbdDateTimeField
          id="location"
          label="Location"
          value={formData.location || ''}
          isTbd={formData.locationTbd}
          onValueChange={(value) => setValue('location', value)}
          onTbdChange={(isTbd, prevValue) => {
            if (isTbd) {
              setPreviousValues((prev) => ({ ...prev, location: prevValue }));
              setValue('locationTbd', true);
              setValue('location', '');
            } else {
              setValue('locationTbd', false);
              setValue('location', previousValues.location);
            }
          }}
          type="text"
        />

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

        <div className="flex items-center space-x-2">
          <Controller
            name="is_paid"
            control={control}
            render={({ field }) => (
              <Checkbox id="is_paid" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <label htmlFor="is_paid" className="text-sm cursor-pointer">
            Paid event
          </label>
        </div>

        {showEventPrivacy && (
          <PrivacyToggle
            isPrivate={formData.is_private}
            onChange={(isPrivate) => setValue('is_private', isPrivate)}
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
