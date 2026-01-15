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
    it('should fetch groups with event and participant counts', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'Test Group',
          organizer_id: 'organizer-1',
          description: 'Test description',
          is_private: false,
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockGroups, error: null }),
      };

      // Mock the initial groups query
      mockSupabase.from.mockReturnValueOnce(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      // Mock event count query
      const eventCountChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
      };
      mockSupabase.from.mockReturnValueOnce(
        eventCountChain as ReturnType<typeof mockSupabase.from>
      );

      // Mock participant count query
      const participantCountChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { participants: { user_id: 'user-1', email: 'user1@example.com', id: 'p1' } },
            { participants: { user_id: 'user-2', email: 'user2@example.com', id: 'p2' } },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(
        participantCountChain as ReturnType<typeof mockSupabase.from>
      );

      const result = await groupService.getGroupsByOrganizer('organizer-1');

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
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await groupService.getGroupsByOrganizer('organizer-1');

      expect(result).toEqual([]);
    });

    it('should deduplicate participants by stable identifier', async () => {
      const mockGroups = [
        {
          id: 'group-1',
          name: 'Test Group',
          organizer_id: 'organizer-1',
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockGroups, error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const eventCountChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
      };
      mockSupabase.from.mockReturnValueOnce(
        eventCountChain as ReturnType<typeof mockSupabase.from>
      );

      // Mock duplicate participants (same user_id)
      const participantCountChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { participants: { user_id: 'user-1', email: 'user1@example.com', id: 'p1' } },
            { participants: { user_id: 'user-1', email: 'user1@example.com', id: 'p2' } },
            { participants: { user_id: null, email: 'guest@example.com', id: 'p3' } },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(
        participantCountChain as ReturnType<typeof mockSupabase.from>
      );

      const result = await groupService.getGroupsByOrganizer('organizer-1');

      // Should only count 2 unique participants (user-1 and guest)
      expect(result[0].participant_count).toBe(2);
    });
  });

  describe('getGroupById', () => {
    it('should fetch a single group by ID', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Test Group',
        organizer_id: 'organizer-1',
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockGroup, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await groupService.getGroupById('group-1');

      expect(result).toEqual(mockGroup);
      expect(mockSupabase.from).toHaveBeenCalledWith('groups');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'group-1');
    });

    it('should throw error when group not found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      await expect(groupService.getGroupById('nonexistent')).rejects.toThrow('Group not found');
    });
  });

  describe('createGroup', () => {
    it('should create a new group with valid data', async () => {
      const newGroup = {
        name: 'New Group',
        description: 'Test description',
        organizer_id: 'organizer-1',
        is_private: false,
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
        is_private: false,
      });
    });

    it('should trim group name before creating', async () => {
      const newGroup = {
        name: '  Trimmed Group  ',
        organizer_id: 'organizer-1',
        description: null,
        is_private: false,
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
        is_private: false,
      };

      await expect(groupService.createGroup(newGroup)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for name that is too long', async () => {
      const newGroup = {
        name: 'a'.repeat(201),
        organizer_id: 'organizer-1',
        description: null,
        is_private: false,
      };

      await expect(groupService.createGroup(newGroup)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for description that is too long', async () => {
      const newGroup = {
        name: 'Valid Name',
        organizer_id: 'organizer-1',
        description: 'a'.repeat(2001),
        is_private: false,
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
        is_private: false,
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
      const eventUpdateChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      const groupDeleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(eventUpdateChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(groupDeleteChain as ReturnType<typeof mockSupabase.from>);

      await groupService.deleteGroup('group-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('events');
      expect(eventUpdateChain.update).toHaveBeenCalledWith({ group_id: null });
      expect(mockSupabase.from).toHaveBeenCalledWith('groups');
      expect(groupDeleteChain.eq).toHaveBeenCalledWith('id', 'group-1');
    });

    it('should delete events when deleteEvents is true', async () => {
      const eventDeleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      const groupDeleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(eventDeleteChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(groupDeleteChain as ReturnType<typeof mockSupabase.from>);

      await groupService.deleteGroup('group-1', true);

      expect(mockSupabase.from).toHaveBeenCalledWith('events');
      expect(eventDeleteChain.delete).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('groups');
      expect(groupDeleteChain.eq).toHaveBeenCalledWith('id', 'group-1');
    });

    it('should throw error if delete fails', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

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
    it('should fetch and deduplicate participants', async () => {
      const mockParticipants = [
        {
          joined_at: '2023-01-01T00:00:00Z',
          participants: {
            id: 'p1',
            name: 'John Doe',
            email: 'john@example.com',
            user_id: 'user-1',
            events: { id: 'event-1', name: 'Event 1' },
          },
        },
        {
          joined_at: '2023-01-02T00:00:00Z',
          participants: {
            id: 'p2',
            name: 'John Doe',
            email: 'john@example.com',
            user_id: 'user-1',
            events: { id: 'event-2', name: 'Event 2' },
          },
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockParticipants, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await groupService.getGroupParticipants('group-1');

      // Should only return 1 unique participant (deduplicated by user_id)
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe('user-1');
      expect(result[0]).toHaveProperty('group_joined_at');
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

      // Mock participant count
      const participantCountChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { participants: { user_id: 'user-1', email: 'user1@example.com', id: 'p1' } },
            { participants: { user_id: 'user-2', email: 'user2@example.com', id: 'p2' } },
          ],
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValueOnce(
        participantCountChain as ReturnType<typeof mockSupabase.from>
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
    it('should add participant to group with stable identifiers', async () => {
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
        participant_id: 'participant-1',
        user_id: 'user-1',
        guest_email: null,
      });
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

    it('should remove guest participant by email', async () => {
      const participantQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { user_id: null, email: 'guest@example.com' },
          error: null,
        }),
      };

      const deleteChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      deleteChain.eq = vi.fn().mockImplementation(() => {
        return { ...deleteChain, error: null };
      });

      mockSupabase.from
        .mockReturnValueOnce(participantQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(deleteChain as ReturnType<typeof mockSupabase.from>);

      await groupService.removeParticipantFromGroup('group-1', 'participant-1');

      expect(deleteChain.eq).toHaveBeenCalledWith('guest_email', 'guest@example.com');
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
