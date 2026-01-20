import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase - must be hoisted
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
    rpc: vi.fn(),
  },
}));

// Mock session validator - must be hoisted
vi.mock('@/lib/sessionValidator', () => ({
  requireValidSession: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
  validateSession: vi.fn().mockResolvedValue({ id: 'test-user-id' }),
}));

import { groupService } from '../groupService';
import { supabase } from '@/lib/supabase';
import { ValidationError } from '@/lib/errorHandler';

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    fromSupabaseError: vi.fn((error) => new Error(error.message)),
  },
  ValidationError: class ValidationError extends Error {
    userMessage: string;
    constructor(message: string, userMessage: string) {
      super(message);
      this.userMessage = userMessage;
      this.name = 'ValidationError';
    }
  },
}));

const mockSupabase = vi.mocked(supabase);

describe('groupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGroupsByOrganizer', () => {
    it('should fetch groups with event and participant counts via RPC', async () => {
      const mockRpcData = [
        {
          id: 'group-1',
          name: 'Test Group',
          organizer_id: 'organizer-1',
          description: 'Test description',
          created_at: '2023-01-01T00:00:00Z',
          event_count: 3,
          participant_count: 2,
        },
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockRpcData, error: null });

      const result = await groupService.getGroupsByOrganizer('organizer-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_groups_with_counts', {
        p_organizer_id: 'organizer-1',
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'group-1',
          name: 'Test Group',
          event_count: 3,
          participant_count: 2,
        })
      );
    });

    it('should return empty array when no groups found', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await groupService.getGroupsByOrganizer('organizer-1');

      expect(result).toEqual([]);
    });

    it('should convert bigint counts to numbers', async () => {
      const mockRpcData = [
        {
          id: 'group-1',
          name: 'Test Group',
          organizer_id: 'organizer-1',
          description: null,
          created_at: '2023-01-01T00:00:00Z',
          event_count: BigInt(5),
          participant_count: BigInt(10),
        },
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockRpcData, error: null });

      const result = await groupService.getGroupsByOrganizer('organizer-1');

      expect(result[0].event_count).toBe(5);
      expect(result[0].participant_count).toBe(10);
      expect(typeof result[0].event_count).toBe('number');
      expect(typeof result[0].participant_count).toBe('number');
    });
  });

  describe('getGroupById', () => {
    it('should fetch a single group with counts via RPC', async () => {
      const mockRpcData = [
        {
          id: 'group-1',
          name: 'Test Group',
          organizer_id: 'organizer-1',
          description: 'Test description',
          created_at: '2023-01-01T00:00:00Z',
          event_count: 5,
          participant_count: 10,
        },
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockRpcData, error: null });

      const result = await groupService.getGroupById('group-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_group_by_id_with_counts', {
        p_group_id: 'group-1',
      });
      expect(result).toEqual(
        expect.objectContaining({
          id: 'group-1',
          name: 'Test Group',
          event_count: 5,
          participant_count: 10,
        })
      );
    });

    it('should throw error when group not found', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      await expect(groupService.getGroupById('nonexistent')).rejects.toThrow('Group not found');
    });

    it('should convert bigint counts to numbers', async () => {
      const mockRpcData = [
        {
          id: 'group-1',
          name: 'Test Group',
          organizer_id: 'organizer-1',
          description: null,
          created_at: '2023-01-01T00:00:00Z',
          event_count: BigInt(5),
          participant_count: BigInt(10),
        },
      ];

      mockSupabase.rpc.mockResolvedValue({ data: mockRpcData, error: null });

      const result = await groupService.getGroupById('group-1');

      expect(result.event_count).toBe(5);
      expect(result.participant_count).toBe(10);
      expect(typeof result.event_count).toBe('number');
      expect(typeof result.participant_count).toBe('number');
    });
  });

  describe('createGroup', () => {
    it('should create a new group with valid data', async () => {
      const newGroup = {
        name: 'New Group',
        description: 'Test description',
        organizer_id: 'organizer-1',
      };

      const mockCreatedGroup = {
        id: 'group-1',
        ...newGroup,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedGroup, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await groupService.createGroup(newGroup);

      expect(result).toEqual(mockCreatedGroup);
      expect(mockSupabase.from).toHaveBeenCalledWith('groups');
      expect(mockQueryChain.insert).toHaveBeenCalledWith({
        name: 'New Group',
        description: 'Test description',
        organizer_id: 'organizer-1',
      });
    });

    it('should trim group name before creating', async () => {
      const newGroup = {
        name: '  Trimmed Group  ',
        organizer_id: 'organizer-1',
        description: null,
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'group-1', ...newGroup }, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await groupService.createGroup(newGroup);

      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trimmed Group',
        })
      );
    });

    it('should throw ValidationError for empty name', async () => {
      const newGroup = {
        name: '',
        organizer_id: 'organizer-1',
        description: null,
      };

      await expect(groupService.createGroup(newGroup)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for name that is too long', async () => {
      const newGroup = {
        name: 'a'.repeat(201),
        organizer_id: 'organizer-1',
        description: null,
      };

      await expect(groupService.createGroup(newGroup)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for description that is too long', async () => {
      const newGroup = {
        name: 'Valid Name',
        organizer_id: 'organizer-1',
        description: 'a'.repeat(2001),
      };

      await expect(groupService.createGroup(newGroup)).rejects.toThrow(ValidationError);
    });
  });

  describe('updateGroup', () => {
    it('should update group with valid data', async () => {
      const updates = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      const mockUpdatedGroup = {
        id: 'group-1',
        organizer_id: 'organizer-1',
        ...updates,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedGroup, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await groupService.updateGroup('group-1', updates);

      expect(result).toEqual(mockUpdatedGroup);
      expect(mockQueryChain.update).toHaveBeenCalledWith({
        name: 'Updated Name',
        description: 'Updated description',
      });
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'group-1');
    });

    it('should trim group name when updating', async () => {
      const updates = { name: '  Trimmed  ' };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'group-1' }, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await groupService.updateGroup('group-1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Trimmed',
        })
      );
    });

    it('should throw ValidationError for invalid updates', async () => {
      const updates = { name: '' };

      await expect(groupService.updateGroup('group-1', updates)).rejects.toThrow(ValidationError);
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group by ID and unassociate events by default', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await groupService.deleteGroup('group-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_group_atomic', {
        p_group_id: 'group-1',
        p_delete_events: false,
      });
    });

    it('should delete events when deleteEvents is true', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null });

      await groupService.deleteGroup('group-1', true);

      expect(mockSupabase.rpc).toHaveBeenCalledWith('delete_group_atomic', {
        p_group_id: 'group-1',
        p_delete_events: true,
      });
    });

    it('should throw error if delete fails', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: { message: 'Delete failed' } });

      await expect(groupService.deleteGroup('group-1')).rejects.toThrow();
    });
  });

  describe('getGroupEvents', () => {
    it('should fetch events for a group with participant counts', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Event 1',
          group_id: 'group-1',
          participants: [{ id: 'p1' }, { id: 'p2' }],
        },
        {
          id: 'event-2',
          name: 'Event 2',
          group_id: 'group-1',
          participants: [{ id: 'p3' }],
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await groupService.getGroupEvents('group-1');

      expect(result).toHaveLength(2);
      expect(result[0].participant_count).toBe(2);
      expect(result[1].participant_count).toBe(1);
      expect(result[0]).not.toHaveProperty('participants');
    });

    it('should handle events with no participants', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Event 1',
          group_id: 'group-1',
          participants: [],
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await groupService.getGroupEvents('group-1');

      expect(result[0].participant_count).toBe(0);
    });
  });

  describe('getGroupParticipants', () => {
    it('should fetch group members and their details', async () => {
      const mockMembersData = [
        {
          user_id: 'user-1',
          joined_at: '2023-01-01T00:00:00Z',
          email: 'john@example.com',
          full_name: 'John Doe',
        },
        {
          user_id: 'user-2',
          joined_at: '2023-01-02T00:00:00Z',
          email: 'jane@example.com',
          full_name: 'Jane Smith',
        },
      ];

      // Mock the RPC call
      mockSupabase.rpc.mockResolvedValue({ data: mockMembersData, error: null });

      const result = await groupService.getGroupParticipants('group-1');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_group_members_with_user_info', {
        p_group_id: 'group-1',
      });
      expect(result).toHaveLength(2);
      expect(result[0].user_id).toBe('user-1');
      expect(result[0].name).toBe('John Doe');
      expect(result[0]).toHaveProperty('group_joined_at');
      expect(result[1].user_id).toBe('user-2');
      expect(result[1].name).toBe('Jane Smith');
    });
  });

  describe('getGroupStats', () => {
    it('should return accurate statistics for a group', async () => {
      // Mock event count
      const eventCountChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
      };
      mockSupabase.from.mockReturnValueOnce(
        eventCountChain as ReturnType<typeof mockSupabase.from>
      );

      // Mock member count
      const memberCountChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          count: 2,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(
        memberCountChain as ReturnType<typeof mockSupabase.from>
      );

      // Mock total registrations
      const registrationsChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
      };
      mockSupabase.from.mockReturnValueOnce(
        registrationsChain as ReturnType<typeof mockSupabase.from>
      );

      const result = await groupService.getGroupStats('group-1');

      expect(result).toEqual({
        event_count: 5,
        participant_count: 2,
        total_registrations: 10,
      });
    });
  });

  describe('addParticipantToGroup', () => {
    it('should add participant to group if they have a user_id', async () => {
      const participantQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-1', email: 'user@example.com' },
          error: null,
        }),
      };

      const insertChain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(participantQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(insertChain as ReturnType<typeof mockSupabase.from>);

      await groupService.addParticipantToGroup('group-1', 'participant-1');

      expect(insertChain.insert).toHaveBeenCalledWith({
        group_id: 'group-1',
        user_id: 'user-1',
      });
    });

    it('should not add guest participants (no user_id)', async () => {
      const participantQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: null, email: 'guest@example.com' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValueOnce(
        participantQueryChain as ReturnType<typeof mockSupabase.from>
      );

      await groupService.addParticipantToGroup('group-1', 'participant-1');

      // Should not attempt to insert
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Only the participant query
    });

    it('should handle duplicate participant gracefully', async () => {
      const participantQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-1', email: 'user@example.com' },
          error: null,
        }),
      };

      const insertChain = {
        insert: vi.fn().mockResolvedValue({ error: { code: '23505' } }), // Unique constraint violation
      };

      mockSupabase.from
        .mockReturnValueOnce(participantQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(insertChain as ReturnType<typeof mockSupabase.from>);

      // Should not throw error
      await expect(
        groupService.addParticipantToGroup('group-1', 'participant-1')
      ).resolves.not.toThrow();
    });
  });

  describe('addUserToGroup', () => {
    it('should add user to group directly', async () => {
      const checkMembershipChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insertChain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(checkMembershipChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(insertChain as ReturnType<typeof mockSupabase.from>);

      await groupService.addUserToGroup('group-1', 'user-1');

      expect(insertChain.insert).toHaveBeenCalledWith({
        group_id: 'group-1',
        user_id: 'user-1',
      });
    });

    it('should not add user if already a member', async () => {
      const checkMembershipChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(
        checkMembershipChain as ReturnType<typeof mockSupabase.from>
      );

      await groupService.addUserToGroup('group-1', 'user-1');

      // Should only call checkMembership, not insert
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should handle duplicate insert gracefully', async () => {
      const checkMembershipChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insertChain = {
        insert: vi.fn().mockResolvedValue({ error: { code: '23505' } }),
      };

      mockSupabase.from
        .mockReturnValueOnce(checkMembershipChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(insertChain as ReturnType<typeof mockSupabase.from>);

      await expect(groupService.addUserToGroup('group-1', 'user-1')).resolves.not.toThrow();
    });
  });

  describe('removeParticipantFromGroup', () => {
    it('should remove participant by user_id', async () => {
      const participantQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-1', email: 'user@example.com' },
          error: null,
        }),
      };

      const deleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      // Mock the chaining for eq calls
      deleteChain.eq = vi.fn().mockImplementation(() => {
        return { ...deleteChain, error: null };
      });

      mockSupabase.from
        .mockReturnValueOnce(participantQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(deleteChain as ReturnType<typeof mockSupabase.from>);

      await groupService.removeParticipantFromGroup('group-1', 'participant-1');

      expect(deleteChain.eq).toHaveBeenCalledWith('group_id', 'group-1');
      expect(deleteChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('should throw error for guest participants (no user_id)', async () => {
      const participantQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: null, email: 'guest@example.com' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValueOnce(
        participantQueryChain as ReturnType<typeof mockSupabase.from>
      );

      await expect(
        groupService.removeParticipantFromGroup('group-1', 'participant-1')
      ).rejects.toThrow('Cannot remove participant: user not found');
    });
  });

  describe('getParticipantGroups', () => {
    it('should fetch groups for a participant by user_id', async () => {
      const participantQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: 'user-1', email: 'user@example.com' },
          error: null,
        }),
      };

      const groupQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              groups: {
                id: 'group-1',
                name: 'Group 1',
                organizer_id: 'organizer-1',
              },
            },
          ],
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(participantQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(groupQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await groupService.getParticipantGroups('participant-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('group-1');
    });

    it('should return empty array for participant with no stable identifier', async () => {
      const participantQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: null, email: null },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValueOnce(
        participantQueryChain as ReturnType<typeof mockSupabase.from>
      );

      const result = await groupService.getParticipantGroups('participant-1');

      expect(result).toEqual([]);
    });
  });
});
