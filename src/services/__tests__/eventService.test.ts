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

import { eventService } from '../eventService';
import { supabase } from '@/lib/supabase';

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    fromSupabaseError: vi.fn((error) => new Error(error.message)),
  },
}));

// Mock validation
vi.mock('@/lib/validation', () => ({
  safeValidateEvent: vi.fn((event) => event),
  validateCustomFields: vi.fn((fields) => fields || []),
}));

const mockSupabase = vi.mocked(supabase);

describe('eventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEventsByOrganizer', () => {
    it('should fetch events for an organizer with participant counts', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Test Event',
          organizer_id: 'organizer-1',
          custom_fields: [],
          is_private: false,
          participants: [{ id: 'p1' }, { id: 'p2' }],
          created_at: '2023-01-01T00:00:00Z',
        },
      ];

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockEvents, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.getEventsByOrganizer('organizer-1');

      // Verify the query was built correctly
      expect(mockSupabase.from).toHaveBeenCalledWith('events');
      expect(mockQueryChain.select).toHaveBeenCalledWith(
        expect.stringContaining('participants!left(id)')
      );
      expect(mockQueryChain.eq).toHaveBeenCalledWith('organizer_id', 'organizer-1');
      expect(mockQueryChain.order).toHaveBeenCalledWith('created_at', { ascending: false });

      // Verify the result is properly mapped
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'event-1',
          name: 'Test Event',
          participant_count: 2,
          custom_fields: [],
          is_private: false,
        })
      );
    });

    it('should return empty array when no events found', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await eventService.getEventsByOrganizer('organizer-1');

      expect(result).toEqual([]);
    });

    it('should handle Supabase errors', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(eventService.getEventsByOrganizer('organizer-1')).rejects.toThrow();
    });
  });
});
