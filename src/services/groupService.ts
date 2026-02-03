import { supabase } from '@/lib/supabase';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import { errorHandler, ValidationError } from '@/lib/errorHandler';
import { requireValidSession } from '@/lib/sessionValidator';

/** Extended Group type with computed event and participant counts */
export interface Group extends Tables<'groups'> {
  event_count?: number;
  participant_count?: number;
}

export interface GroupParticipant
  extends Omit<
    Tables<'participants'>,
    'event_id' | 'payment_status' | 'slot_number' | 'checked_in_at'
  > {
  event_id: string | null;
  payment_status: string | null;
  slot_number: number | null;
  checked_in_at: string | null;
  event: {
    id: string;
    name: string;
  } | null;
  group_joined_at: string;
  avatar_url: string | null;
}

export interface GroupContact {
  id: string;
  name: string;
  email: string | null;
  user_id: string | null;
  first_seen: string;
}

/** Internal interface for nested Supabase query results */
interface EventWithParticipants extends Tables<'events'> {
  participants: Array<{ id: string } | null>;
}

interface GroupQueryResult {
  groups: Tables<'groups'> | Array<Tables<'groups'>>;
}

export interface GroupStats {
  event_count: number;
  participant_count: number;
  total_registrations: number;
}

export type GroupAdmin = Tables<'group_admins'>;

/**
 * Validates group data before create or update operations.
 * @param group - Partial group data to validate
 * @throws ValidationError if name is empty, too long, or description is too long
 */
function validateGroupData(group: Partial<Group>): void {
  if (group.name !== undefined) {
    if (!group.name || group.name.trim().length === 0) {
      throw new ValidationError('Group name is required', 'Please enter a group name');
    }
    if (group.name.length > 200) {
      throw new ValidationError(
        'Group name is too long',
        'Group name must be 200 characters or less'
      );
    }
  }

  if (group.description !== undefined && group.description !== null) {
    if (group.description.length > 2000) {
      throw new ValidationError(
        'Group description is too long',
        'Description must be 2000 characters or less'
      );
    }
  }
}

export const groupService = {
  /**
   * Retrieves all groups created by an organizer with event and member counts.
   * @param organizerId - UUID of the organizer
   * @returns Groups with event_count and participant_count populated
   * @throws Error if database query fails
   */
  async getGroupsByOrganizer(organizerId: string): Promise<Group[]> {
    const { data, error } = await supabase.rpc('get_groups_with_counts', {
      p_organizer_id: organizerId,
    });

    if (error) throw errorHandler.fromSupabaseError(error);

    if (!data) return [];

    return data.map((group) => ({
      id: group.id,
      organizer_id: group.organizer_id,
      name: group.name,
      description: group.description,
      created_at: group.created_at,
      event_count: Number(group.event_count),
      participant_count: Number(group.participant_count),
    }));
  },

  /**
   * Retrieves a single group by ID with event and member counts.
   * @param groupId - UUID of the group
   * @returns Group with computed counts
   * @throws Error if group not found or query fails
   */
  async getGroupById(groupId: string): Promise<Group> {
    const { data, error } = await supabase.rpc('get_group_by_id_with_counts', {
      p_group_id: groupId,
    });

    if (error) throw errorHandler.fromSupabaseError(error);
    if (!data || data.length === 0) throw new Error('Group not found');

    const group = data[0];
    return {
      id: group.id,
      organizer_id: group.organizer_id,
      name: group.name,
      description: group.description,
      created_at: group.created_at,
      event_count: Number(group.event_count),
      participant_count: Number(group.participant_count),
    };
  },

  /**
   * Creates a new group and adds the organizer as a member.
   * Requires an authenticated session. ID is auto-generated.
   * @param group - Group data without id, created_at, or computed counts
   * @returns The created group
   * @throws ValidationError if group data is invalid
   * @throws Error if session is invalid or creation fails
   */
  async createGroup(
    group: Omit<Group, 'id' | 'created_at' | 'event_count' | 'participant_count'>
  ): Promise<Group> {
    await requireValidSession();
    validateGroupData(group);

    const insertData: TablesInsert<'groups'> = {
      organizer_id: group.organizer_id,
      name: group.name.trim(),
      description: group.description,
    };

    const { data, error } = await supabase.from('groups').insert(insertData).select().single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create group');

    await supabase.from('group_participants').insert({
      group_id: data.id,
      user_id: group.organizer_id,
    });

    return data;
  },

  /**
   * Updates an existing group with partial data.
   * Requires an authenticated session.
   * @param groupId - UUID of the group to update
   * @param updates - Partial group data (name and/or description)
   * @returns The updated group
   * @throws ValidationError if update data is invalid
   * @throws Error if session invalid or group not found
   */
  async updateGroup(groupId: string, updates: Partial<Group>): Promise<Group> {
    await requireValidSession();
    validateGroupData(updates);

    const updateData: TablesUpdate<'groups'> = {};

    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.description !== undefined) updateData.description = updates.description;

    const { data, error } = await supabase
      .from('groups')
      .update(updateData)
      .eq('id', groupId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to update group');

    return data;
  },

  /**
   * Deletes a group atomically via RPC.
   * Optionally deletes associated events or unlinks them from the group.
   * Requires an authenticated session.
   * @param groupId - UUID of the group to delete
   * @param deleteEvents - If true, delete events; if false, unlink them
   * @throws Error if session invalid or deletion fails
   */
  async deleteGroup(groupId: string, deleteEvents: boolean = false): Promise<void> {
    await requireValidSession();

    const { error } = await supabase.rpc('delete_group_atomic', {
      p_group_id: groupId,
      p_delete_events: deleteEvents,
    });

    if (error) throw error;
  },

  /**
   * Retrieves all events belonging to a group with participant counts.
   * @param groupId - UUID of the group
   * @returns Events sorted by datetime with participant_count populated
   * @throws Error if database query fails
   */
  async getGroupEvents(
    groupId: string
  ): Promise<Array<Tables<'events'> & { participant_count?: number }>> {
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select(
        `
        *,
        participants!left(id)
      `
      )
      .eq('group_id', groupId)
      .order('datetime', { ascending: true });

    if (eventsError) throw errorHandler.fromSupabaseError(eventsError);

    if (!eventsData) return [];

    return eventsData.map((event: EventWithParticipants) => {
      const participantCount = Array.isArray(event.participants)
        ? event.participants.filter((p) => p !== null).length
        : 0;

      const { participants, ...eventWithoutParticipants } = event;
      void participants;

      return {
        ...eventWithoutParticipants,
        participant_count: participantCount,
      };
    });
  },

  /**
   * Retrieves all members of a group with their user info from auth.users.
   * @param groupId - UUID of the group
   * @returns Array of group participants with avatar URLs and names
   * @throws Error if database query fails
   */
  async getGroupParticipants(groupId: string): Promise<GroupParticipant[]> {
    const { data: membersData, error: membersError } = await supabase.rpc(
      'get_group_members_with_user_info',
      { p_group_id: groupId }
    );

    if (membersError) throw errorHandler.fromSupabaseError(membersError);
    if (!membersData || membersData.length === 0) return [];

    return membersData.map((member) => ({
      id: member.user_id,
      user_id: member.user_id,
      name: member.full_name || member.email || 'Group Member',
      email: member.email,
      phone: null,
      responses: {},
      event_id: null,
      created_at: member.joined_at,
      group_joined_at: member.joined_at,
      event: {
        id: '',
        name: '',
      },
      claimed_by_user_id: null,
      notes: null,
      payment_marked_at: null,
      payment_notes: null,
      payment_status: null,
      slot_number: null,
      checked_in_at: null,
      avatar_url: member.avatar_url || null,
    }));
  },

  /**
   * Gets statistics for a group: event count, member count, and total registrations.
   * @param groupId - UUID of the group
   * @returns Object with event_count, participant_count, and total_registrations
   * @throws Error if any database query fails
   */
  async getGroupStats(groupId: string): Promise<GroupStats> {
    const { count: eventCount, error: eventError } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if (eventError) throw errorHandler.fromSupabaseError(eventError);

    const { count: memberCount, error: memberError } = await supabase
      .from('group_participants')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if (memberError) throw errorHandler.fromSupabaseError(memberError);

    const { count: totalRegistrations, error: registrationsError } = await supabase
      .from('participants')
      .select('event_id, events!inner(group_id)', { count: 'exact', head: true })
      .eq('events.group_id', groupId);

    if (registrationsError) throw errorHandler.fromSupabaseError(registrationsError);

    return {
      event_count: eventCount || 0,
      participant_count: memberCount || 0,
      total_registrations: totalRegistrations || 0,
    };
  },

  /**
   * Adds a participant to a group via their user_id.
   * Only participants with linked user accounts can be added. Idempotent.
   * @param groupId - UUID of the group
   * @param participantId - UUID of the participant record
   * @throws Error if participant not found or insertion fails
   */
  async addParticipantToGroup(groupId: string, participantId: string): Promise<void> {
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select('user_id')
      .eq('id', participantId)
      .single();

    if (participantError) throw errorHandler.fromSupabaseError(participantError);
    if (!participantData) throw new Error('Participant not found');

    if (!participantData.user_id) {
      return;
    }

    const insertData: TablesInsert<'group_participants'> = {
      group_id: groupId,
      user_id: participantData.user_id,
    };

    const { error } = await supabase.from('group_participants').insert(insertData);

    if (error) {
      if (error.code !== '23505') {
        throw errorHandler.fromSupabaseError(error);
      }
    }
  },

  /**
   * Gets all unique contacts from all groups owned by an organizer.
   * Deduplicates by user_id and returns contact details.
   * @param organizerId - UUID of the organizer
   * @returns Unique contacts sorted alphabetically by name
   * @throws Error if database query fails
   */
  async getAllContactsFromGroups(organizerId: string): Promise<GroupContact[]> {
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id')
      .eq('organizer_id', organizerId);

    if (groupsError) throw errorHandler.fromSupabaseError(groupsError);
    if (!groups || groups.length === 0) return [];

    const groupIds = groups.map((g) => g.id);

    const { data: groupMembersData, error: membersError } = await supabase
      .from('group_participants')
      .select('user_id, joined_at')
      .in('group_id', groupIds)
      .order('joined_at', { ascending: true });

    if (membersError) throw errorHandler.fromSupabaseError(membersError);
    if (!groupMembersData || groupMembersData.length === 0) return [];

    const contactsMap = new Map<string, GroupContact>();

    for (const member of groupMembersData) {
      if (contactsMap.has(member.user_id)) continue;

      const { data: participantData } = await supabase
        .from('participants')
        .select('name, email')
        .eq('user_id', member.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      contactsMap.set(member.user_id, {
        id: member.user_id,
        name: participantData?.name || 'Group Member',
        email: participantData?.email || null,
        user_id: member.user_id,
        first_seen: member.joined_at,
      });
    }

    return Array.from(contactsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  },

  /**
   * Removes a participant from a group via their user_id.
   * @param groupId - UUID of the group
   * @param participantId - UUID of the participant record
   * @throws Error if participant not found or deletion fails
   */
  async removeParticipantFromGroup(groupId: string, participantId: string): Promise<void> {
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select('user_id')
      .eq('id', participantId)
      .single();

    if (participantError) throw errorHandler.fromSupabaseError(participantError);
    if (!participantData || !participantData.user_id) {
      throw new Error('Cannot remove participant: user not found');
    }

    const { error } = await supabase
      .from('group_participants')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', participantData.user_id);

    if (error) throw errorHandler.fromSupabaseError(error);
  },

  /**
   * Gets all groups that a participant belongs to via their user_id.
   * @param participantId - UUID of the participant record
   * @returns Array of groups the participant is a member of
   * @throws Error if participant not found or query fails
   */
  async getParticipantGroups(participantId: string): Promise<Group[]> {
    const { data: participantData, error: participantError } = await supabase
      .from('participants')
      .select('user_id')
      .eq('id', participantId)
      .single();

    if (participantError) throw errorHandler.fromSupabaseError(participantError);
    if (!participantData || !participantData.user_id) return [];

    const { data: groupData, error: groupError } = await supabase
      .from('group_participants')
      .select(
        `
        groups!inner (*)
      `
      )
      .eq('user_id', participantData.user_id);

    if (groupError) throw errorHandler.fromSupabaseError(groupError);

    if (!groupData) return [];

    return groupData.map((item: GroupQueryResult) => {
      const group = item.groups;
      return Array.isArray(group) ? group[0] : group;
    });
  },

  /**
   * Checks if a user is an admin of a group (either owner or in group_admins table).
   * @param groupId - UUID of the group
   * @param userId - UUID of the user to check
   * @returns True if user is owner or admin, false otherwise
   * @throws Error if database query fails
   */
  async isGroupAdmin(groupId: string, userId: string): Promise<boolean> {
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('organizer_id')
      .eq('id', groupId)
      .single();

    if (groupError) throw errorHandler.fromSupabaseError(groupError);
    if (!group) return false;

    if (group.organizer_id === userId) return true;

    const { data: adminRecord, error: adminError } = await supabase
      .from('group_admins')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (adminError) throw errorHandler.fromSupabaseError(adminError);

    return adminRecord !== null;
  },

  /**
   * Adds a user as an admin of a group. Idempotent.
   * @param groupId - UUID of the group
   * @param userId - UUID of the user to make admin
   * @throws Error if insertion fails (except duplicates)
   */
  async addGroupAdmin(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('group_admins').insert({
      group_id: groupId,
      user_id: userId,
    });

    if (error) {
      if (error.code !== '23505') {
        throw errorHandler.fromSupabaseError(error);
      }
    }
  },

  /**
   * Removes a user's admin privileges from a group.
   * @param groupId - UUID of the group
   * @param userId - UUID of the admin to remove
   * @throws Error if deletion fails
   */
  async removeGroupAdmin(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('group_admins')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw errorHandler.fromSupabaseError(error);
  },

  /**
   * Gets all admins for a group, sorted by creation date.
   * @param groupId - UUID of the group
   * @returns Array of group admin records
   * @throws Error if database query fails
   */
  async getGroupAdmins(groupId: string): Promise<GroupAdmin[]> {
    const { data, error } = await supabase
      .from('group_admins')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) throw errorHandler.fromSupabaseError(error);

    return data || [];
  },

  /**
   * Adds multiple participants to a group in batch via RPC.
   * @param groupId - UUID of the group
   * @param participantIds - Array of participant UUIDs to add
   * @returns Counts of added, skipped (already members), and failed
   * @throws Error if RPC call fails
   */
  async addParticipantsToGroupBatch(
    groupId: string,
    participantIds: string[]
  ): Promise<{ added: number; skipped: number; failed: number }> {
    const { data, error } = await supabase.rpc('add_participants_to_group', {
      p_group_id: groupId,
      p_participant_ids: participantIds,
    });

    if (error) throw errorHandler.fromSupabaseError(error);

    if (!data || data.length === 0) {
      return { added: 0, skipped: 0, failed: participantIds.length };
    }

    const result = data[0];
    return {
      added: result.added_count || 0,
      skipped: result.skipped_count || 0,
      failed: result.failed_count || 0,
    };
  },

  /**
   * Removes multiple participants from a group in batch via RPC.
   * @param groupId - UUID of the group
   * @param participantIds - Array of participant UUIDs to remove
   * @returns Counts of removed and failed
   * @throws Error if RPC call fails
   */
  async removeParticipantsFromGroupBatch(
    groupId: string,
    participantIds: string[]
  ): Promise<{ removed: number; failed: number }> {
    const { data, error } = await supabase.rpc('remove_participants_from_group', {
      p_group_id: groupId,
      p_participant_ids: participantIds,
    });

    if (error) throw errorHandler.fromSupabaseError(error);

    if (!data || data.length === 0) {
      return { removed: 0, failed: participantIds.length };
    }

    const result = data[0];
    return {
      removed: result.removed_count || 0,
      failed: result.failed_count || 0,
    };
  },

  /**
   * Checks if a user is a member of a group.
   * @param userId - UUID of the user
   * @param groupId - UUID of the group
   * @returns True if user is a member, false otherwise
   * @throws Error if database query fails
   */
  async checkUserGroupMembership(userId: string, groupId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('group_participants')
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw errorHandler.fromSupabaseError(error);

    return data !== null;
  },

  /**
   * Adds a user directly to a group by user ID. Idempotent.
   * @param groupId - UUID of the group
   * @param userId - UUID of the user to add
   * @throws Error if insertion fails (except duplicates)
   */
  async addUserToGroup(groupId: string, userId: string): Promise<void> {
    const alreadyMember = await this.checkUserGroupMembership(userId, groupId);
    if (alreadyMember) {
      return;
    }

    const insertData: TablesInsert<'group_participants'> = {
      group_id: groupId,
      user_id: userId,
    };

    const { error } = await supabase.from('group_participants').insert(insertData);

    if (error) {
      if (error.code !== '23505') {
        throw errorHandler.fromSupabaseError(error);
      }
    }
  },

  /**
   * Gets all groups a user is a member of with event and member counts.
   * @param userId - UUID of the user
   * @returns Groups with computed counts
   * @throws Error if database query fails
   */
  async getGroupsByUser(userId: string): Promise<Group[]> {
    const { data, error } = await supabase.rpc('get_user_groups_with_counts', {
      p_user_id: userId,
    });

    if (error) throw errorHandler.fromSupabaseError(error);

    if (!data || data.length === 0) return [];

    return data.map((group) => ({
      id: group.id,
      organizer_id: group.organizer_id,
      name: group.name,
      description: group.description,
      created_at: group.created_at,
      event_count: Number(group.event_count),
      participant_count: Number(group.participant_count),
    }));
  },

  /**
   * Removes a user from a group (user leaving voluntarily).
   * @param groupId - UUID of the group
   * @param userId - UUID of the user leaving
   * @throws Error if deletion fails
   */
  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('group_participants')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    if (error) throw errorHandler.fromSupabaseError(error);
  },
};
