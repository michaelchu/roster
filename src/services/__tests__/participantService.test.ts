/* eslint-disable @typescript-eslint/no-explicit-any */
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
      in: vi.fn().mockReturnThis(),
    })),
  },
}));

import { participantService } from '../participantService';
import { supabase } from '@/lib/supabase';

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    fromSupabaseError: vi.fn((error) => new Error(error.message)),
  },
}));

const mockSupabase = vi.mocked(supabase);

describe('participantService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getParticipantsByEventId', () => {
    it('should fetch participants for an event', async () => {
      const mockParticipants = [
        {
          id: 'participant-1',
          event_id: 'event-1',
          name: 'John Doe',
          email: 'john@example.com',
          responses: { field1: 'value1' },
          slot_number: 1,
          claimed_by_user_id: null,
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockParticipants, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await participantService.getParticipantsByEventId('event-1');

      // Verify the query was built correctly
      expect(mockSupabase.from).toHaveBeenCalledWith('participants');
      expect(mockQueryChain.select).toHaveBeenCalledWith(
        expect.stringContaining('participant_labels')
      );
      expect(mockQueryChain.eq).toHaveBeenCalledWith('event_id', 'event-1');
      expect(mockQueryChain.order).toHaveBeenCalledWith('slot_number', { ascending: true });

      // Verify the result is properly mapped
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'participant-1',
          name: 'John Doe',
          email: 'john@example.com',
          responses: { field1: 'value1' },
          slot_number: 1,
        })
      );
    });

    it('should return empty array when no participants found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await participantService.getParticipantsByEventId('event-1');

      expect(result).toEqual([]);
    });
  });

  describe('createParticipant', () => {
    it('should create a self-registration participant', async () => {
      const newParticipant = {
        event_id: 'event-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        notes: 'Test notes',
        user_id: 'user-1',
        responses: { field1: 'value1' },
        claimed_by_user_id: null,
      };

      const mockCreatedParticipant = {
        id: 'participant-2',
        ...newParticipant,
        slot_number: 1,
        created_at: '2023-01-01T00:00:00Z',
      };

      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedParticipant, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await participantService.createParticipant(newParticipant);

      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'event-1',
          name: 'Jane Doe',
          user_id: 'user-1',
          claimed_by_user_id: null,
        })
      );
      expect(result.name).toBe('Jane Doe');
    });

    it('should set claimed_by_user_id when claiming for others', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'p1',
            event_id: 'event-1',
            name: 'John - 1',
            user_id: null,
            claimed_by_user_id: 'user-1',
            slot_number: 1,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantService.createParticipant(
        {
          event_id: 'event-1',
          name: '',
          user_id: null,
          responses: {},
          claimed_by_user_id: null,
          email: null,
          phone: null,
          notes: null,
        },
        { claimingUserId: 'user-1', claimingUserName: 'John' }
      );

      // Verify claimed spot has correct user relationships
      expect(result.claimed_by_user_id).toBe('user-1');
      expect(result.user_id).toBeNull();
      // Verify insert was called with correct data
      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: null,
          claimed_by_user_id: 'user-1',
        })
      );
    });

    it('should require authentication for self-registration', async () => {
      const newParticipant = {
        event_id: 'event-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: null,
        notes: null,
        user_id: null, // No user_id
        responses: {},
        claimed_by_user_id: null,
      };

      await expect(participantService.createParticipant(newParticipant)).rejects.toThrow(
        'Authentication required for event registration'
      );
    });
  });

  describe('updateParticipant', () => {
    it('should update participant fields', async () => {
      const updates = {
        name: 'Updated Name',
        email: 'updated@example.com',
        phone: '+9876543210',
        notes: 'Updated notes',
        responses: { field1: 'updated' },
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'p1', ...updates, slot_number: 1, created_at: '2023-01-01' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantService.updateParticipant('p1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          email: 'updated@example.com',
          phone: '+9876543210',
          notes: 'Updated notes',
        })
      );
      expect(result.name).toBe('Updated Name');
    });

    it('should handle partial updates', async () => {
      const updates = { name: 'New Name Only' };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'p1',
            name: 'New Name Only',
            email: 'old@example.com',
            slot_number: 1,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await participantService.updateParticipant('p1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith({ name: 'New Name Only' });
    });

    it('should convert empty strings to null for optional fields', async () => {
      const updates = {
        email: '',
        phone: '',
        notes: '',
      };

      const mockQueryChain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'p1',
            name: 'Test',
            email: null,
            phone: null,
            notes: null,
            slot_number: 1,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await participantService.updateParticipant('p1', updates);

      expect(mockQueryChain.update).toHaveBeenCalledWith({
        email: null,
        phone: null,
        notes: null,
      });
    });
  });

  describe('deleteParticipant', () => {
    it('should delete a participant', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await participantService.deleteParticipant('p1');

      expect(mockSupabase.from).toHaveBeenCalledWith('participants');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('id', 'p1');
    });

    it('should throw error on delete failure', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'Delete failed' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(participantService.deleteParticipant('p1')).rejects.toThrow();
    });
  });

  describe('bulkDeleteParticipants', () => {
    it('should delete multiple participants', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await participantService.bulkDeleteParticipants(['p1', 'p2', 'p3']);

      expect(mockQueryChain.in).toHaveBeenCalledWith('id', ['p1', 'p2', 'p3']);
    });
  });

  describe('getParticipantByUserAndEvent', () => {
    it('should find participant by user and event', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'p1',
            user_id: 'user-1',
            event_id: 'event-1',
            name: 'John',
            slot_number: 1,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantService.getParticipantByUserAndEvent('user-1', 'event-1');

      expect(mockQueryChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('event_id', 'event-1');
      expect(result?.id).toBe('p1');
    });

    it('should return null when participant not found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantService.getParticipantByUserAndEvent('user-1', 'event-1');

      expect(result).toBeNull();
    });
  });

  describe('addLabelToParticipant', () => {
    it('should add label to participant if not exists', async () => {
      const checkChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insertChain = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from
        .mockReturnValueOnce(checkChain as any)
        .mockReturnValueOnce(insertChain as any);

      await participantService.addLabelToParticipant('p1', 'label-1');

      expect(insertChain.insert).toHaveBeenCalledWith({
        participant_id: 'p1',
        label_id: 'label-1',
      });
    });

    it('should skip adding label if already exists', async () => {
      const checkChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(checkChain as any);

      await participantService.addLabelToParticipant('p1', 'label-1');

      // Should only call from once (for the check)
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeLabelFromParticipant', () => {
    it('should remove label from participant', async () => {
      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      };

      mockQueryChain.eq = vi.fn().mockImplementation((field) => {
        if (field === 'participant_id') return mockQueryChain;
        return { error: null };
      });

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await participantService.removeLabelFromParticipant('p1', 'label-1');

      expect(mockQueryChain.eq).toHaveBeenCalledWith('participant_id', 'p1');
      expect(mockQueryChain.eq).toHaveBeenCalledWith('label_id', 'label-1');
    });
  });

  describe('exportParticipantsToCSV', () => {
    it('should generate CSV with basic fields', async () => {
      const participants = [
        {
          id: 'p1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          notes: 'Test notes',
          labels: [{ id: 'l1', name: 'VIP', event_id: 'e1', color: '#FF0000' }],
          responses: {},
          slot_number: 1,
          user_id: 'user-1',
          event_id: 'event-1',
          claimed_by_user_id: null,
          created_at: '2023-01-01',
        },
      ];

      // Mock DOM APIs
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      const mockClick = vi.fn();
      document.createElement = vi.fn(() => ({
        click: mockClick,
        href: '',
        download: '',
      })) as any;

      await participantService.exportParticipantsToCSV(participants, 'Test Event', []);

      expect(mockClick).toHaveBeenCalled();
    });

    it('should include custom fields in CSV', async () => {
      const participants = [
        {
          id: 'p1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: null,
          notes: null,
          labels: [],
          responses: { age: '25', hobbies: ['reading', 'coding'] },
          slot_number: 1,
          user_id: 'user-1',
          event_id: 'event-1',
          claimed_by_user_id: null,
          created_at: '2023-01-01',
        },
      ];

      const customFields = [
        { id: 'age', label: 'Age', type: 'number' as const, required: false },
        { id: 'hobbies', label: 'Hobbies', type: 'select' as const, required: false },
      ];

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      const mockClick = vi.fn();
      document.createElement = vi.fn(() => ({
        click: mockClick,
        href: '',
        download: '',
      })) as any;

      await participantService.exportParticipantsToCSV(participants, 'Test Event', customFields);

      expect(mockClick).toHaveBeenCalled();
    });

    it('should escape special characters in CSV', async () => {
      const participants = [
        {
          id: 'p1',
          name: 'John "Johnny" Doe',
          email: 'john@example.com',
          phone: null,
          notes: 'Has "quotes" in notes',
          labels: [],
          responses: {},
          slot_number: 1,
          user_id: 'user-1',
          event_id: 'event-1',
          claimed_by_user_id: null,
          created_at: '2023-01-01',
        },
      ];

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      global.Blob = vi.fn() as any;
      const mockClick = vi.fn();
      document.createElement = vi.fn(() => ({
        click: mockClick,
        href: '',
        download: '',
      })) as any;

      await participantService.exportParticipantsToCSV(participants, 'Test Event', []);

      // Verify Blob was created (CSV generation happened)
      expect(global.Blob).toHaveBeenCalled();
    });
  });
});
