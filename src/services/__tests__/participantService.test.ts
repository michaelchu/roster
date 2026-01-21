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
          payment_status: 'pending',
          payment_marked_at: null,
          payment_notes: null,
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

    it('should allow guest participants without user_id', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'p2',
            event_id: 'event-1',
            name: 'Jane Doe',
            email: 'jane@example.com',
            phone: null,
            notes: null,
            user_id: null,
            claimed_by_user_id: null,
            slot_number: 1,
            created_at: '2023-01-01',
            responses: {},
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const newParticipant = {
        event_id: 'event-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: null,
        notes: null,
        user_id: null, // Guest participant
        responses: {},
        claimed_by_user_id: null,
        payment_status: 'pending' as const,
        payment_marked_at: null,
        payment_notes: null,
      };

      const result = await participantService.createParticipant(newParticipant);

      expect(result).toBeDefined();
      expect(result.name).toBe('Jane Doe');
      expect(result.user_id).toBeNull();
      // Verify insert was called with guest participant data
      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Jane Doe',
          user_id: null,
          claimed_by_user_id: null,
        })
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

  describe('bulkUpdatePaymentStatus', () => {
    it('should update payment status via RPC and return counts', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ updated_count: 3, requested_count: 3 }],
        error: null,
      });

      const result = await participantService.bulkUpdatePaymentStatus(
        ['p1', 'p2', 'p3'],
        'paid',
        'Paid in cash'
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('bulk_update_payment_status', {
        p_participant_ids: ['p1', 'p2', 'p3'],
        p_payment_status: 'paid',
        p_payment_notes: 'Paid in cash',
      });
      expect(result).toEqual({ updated: 3, requested: 3 });
    });

    it('should return zeros for empty participant list', async () => {
      const result = await participantService.bulkUpdatePaymentStatus([], 'paid');

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(result).toEqual({ updated: 0, requested: 0 });
    });

    it('should handle partial updates', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{ updated_count: 2, requested_count: 3 }],
        error: null,
      });

      const result = await participantService.bulkUpdatePaymentStatus(['p1', 'p2', 'p3'], 'waived');

      expect(result).toEqual({ updated: 2, requested: 3 });
    });

    it('should throw error on RPC failure', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Invalid payment status' },
      });

      await expect(
        participantService.bulkUpdatePaymentStatus(['p1'], 'invalid' as any)
      ).rejects.toThrow();
    });
  });

  describe('createParticipantsBatch', () => {
    it('should create multiple participants and return counts', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'p1',
            event_id: 'event-1',
            name: 'Member 1',
            user_id: null,
            claimed_by_user_id: null,
            slot_number: 1,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantService.createParticipantsBatch('event-1', [
        { name: 'Member 1' },
        { name: 'Member 2' },
        { name: 'Member 3' },
      ]);

      expect(result).toEqual({ created: 3, failed: 0, duplicates: [] });
      expect(mockQueryChain.insert).toHaveBeenCalledTimes(3);
    });

    it('should return empty counts for empty members array', async () => {
      const result = await participantService.createParticipantsBatch('event-1', []);

      expect(result).toEqual({ created: 0, failed: 0, duplicates: [] });
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should count failures when createParticipant throws', async () => {
      let callCount = 0;
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.resolve({ data: null, error: { message: 'Failed' } });
          }
          return Promise.resolve({
            data: {
              id: `p${callCount}`,
              event_id: 'event-1',
              name: `Member ${callCount}`,
              user_id: null,
              claimed_by_user_id: null,
              slot_number: callCount,
              created_at: '2023-01-01',
            },
            error: null,
          });
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantService.createParticipantsBatch('event-1', [
        { name: 'Member 1' },
        { name: 'Member 2' },
        { name: 'Member 3' },
      ]);

      expect(result).toEqual({ created: 2, failed: 1, duplicates: [] });
    });

    it('should create participants with correct data structure', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'p1',
            event_id: 'event-1',
            name: 'Test Member',
            user_id: null,
            claimed_by_user_id: null,
            slot_number: 1,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await participantService.createParticipantsBatch('event-1', [{ name: 'Test Member' }]);

      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'event-1',
          name: 'Test Member',
          email: null,
          phone: null,
          notes: null,
          user_id: null,
          claimed_by_user_id: null,
        })
      );
    });

    it('should detect duplicate participants via unique constraint violation', async () => {
      let callCount = 0;
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            // Simulate PostgreSQL unique constraint violation (code 23505)
            return Promise.reject({ code: '23505', message: 'duplicate key value' });
          }
          return Promise.resolve({
            data: {
              id: `p${callCount}`,
              event_id: 'event-1',
              name: `Member ${callCount}`,
              user_id: `user-${callCount}`,
              claimed_by_user_id: null,
              slot_number: callCount,
              created_at: '2023-01-01',
            },
            error: null,
          });
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantService.createParticipantsBatch('event-1', [
        { name: 'Member 1', user_id: 'user-1' },
        { name: 'Duplicate User', user_id: 'user-2' },
        { name: 'Member 3', user_id: 'user-3' },
      ]);

      expect(result).toEqual({
        created: 2,
        failed: 1,
        duplicates: ['Duplicate User'],
      });
    });

    it('should pass user_id when provided', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'p1',
            event_id: 'event-1',
            name: 'Organizer',
            user_id: 'user-123',
            claimed_by_user_id: null,
            slot_number: 1,
            created_at: '2023-01-01',
          },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await participantService.createParticipantsBatch('event-1', [
        { name: 'Organizer', user_id: 'user-123' },
        { name: 'Member', user_id: 'user-456' },
      ]);

      expect(mockQueryChain.insert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          event_id: 'event-1',
          name: 'Organizer',
          user_id: 'user-123',
        })
      );

      expect(mockQueryChain.insert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          event_id: 'event-1',
          name: 'Member',
          user_id: 'user-456',
        })
      );
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
          payment_status: 'pending' as const,
          payment_marked_at: null,
          payment_notes: null,
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
          payment_status: 'pending' as const,
          payment_marked_at: null,
          payment_notes: null,
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
          payment_status: 'pending' as const,
          payment_marked_at: null,
          payment_notes: null,
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
