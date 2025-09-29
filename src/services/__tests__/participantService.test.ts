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

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

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

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantService.getParticipantsByEventId('event-1');

      expect(result).toEqual([]);
    });
  });

  describe('createParticipant', () => {
    it('should create a new participant', async () => {
      const newParticipant = {
        event_id: 'event-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
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

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await participantService.createParticipant(newParticipant);

      // Verify the query was built correctly
      expect(mockSupabase.from).toHaveBeenCalledWith('participants');
      expect(mockQueryChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'event-1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          user_id: 'user-1',
        })
      );
      expect(mockQueryChain.select).toHaveBeenCalled();
      expect(mockQueryChain.single).toHaveBeenCalled();

      // Verify the result
      expect(result).toEqual(
        expect.objectContaining({
          id: 'participant-2',
          name: 'Jane Doe',
          email: 'jane@example.com',
        })
      );
    });

    it('should handle Supabase errors during creation', async () => {
      const mockQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const newParticipant = {
        event_id: 'event-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        user_id: 'user-1',
        responses: {},
        claimed_by_user_id: null,
      };

      await expect(participantService.createParticipant(newParticipant)).rejects.toThrow();
    });
  });
});
