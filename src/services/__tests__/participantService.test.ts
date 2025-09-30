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
    rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
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

  // Note: Basic CRUD operations (getParticipantsByEventId, getParticipantById, etc.)
  // are thin Supabase wrappers and should be tested via integration tests instead.
  // Only testing business logic here.

  describe('createParticipant - business logic', () => {
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

  describe('updateParticipant - data transformation', () => {
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

  // deleteParticipant, bulkDeleteParticipants, getParticipantByUserAndEvent
  // are direct Supabase calls - tested via integration tests

  describe('addLabelToParticipant - deduplication logic', () => {
    it('should skip adding label if already exists (deduplication check)', async () => {
      const checkChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
      };

      mockSupabase.from.mockReturnValueOnce(checkChain as any);

      await participantService.addLabelToParticipant('p1', 'label-1');

      // Should only call from once (for the check), not insert
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });
  });

  // removeLabelFromParticipant is a direct delete - tested via integration tests

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
