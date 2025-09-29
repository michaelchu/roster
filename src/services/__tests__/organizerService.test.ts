import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase - must be hoisted
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
    })),
  },
}));

import { organizerService } from '../organizerService';
import { supabase } from '@/lib/supabase';

const mockSupabase = vi.mocked(supabase);

describe('organizerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getOrganizerById', () => {
    it('should return null on error (error handling logic)', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as ReturnType<typeof mockSupabase.from>);

      const result = await organizerService.getOrganizerById('nonexistent');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error fetching organizer:', {
        message: 'Not found',
      });
    });
  });

  describe('ensureOrganizerExists', () => {
    it('should create organizer if not exists', async () => {
      // Mock getOrganizerById to return null
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      // Mock createOrganizer
      const createQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-1', name: 'John', created_at: '2023-01-01T00:00:00Z' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(createQueryChain as ReturnType<typeof mockSupabase.from>);

      await organizerService.ensureOrganizerExists('user-1', 'John');

      expect(createQueryChain.insert).toHaveBeenCalledWith({
        id: 'user-1',
        name: 'John',
      });
    });

    it('should not create organizer if already exists', async () => {
      // Mock getOrganizerById to return existing organizer
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-1', name: 'John', created_at: '2023-01-01T00:00:00Z' },
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValueOnce(getQueryChain as ReturnType<typeof mockSupabase.from>);

      await organizerService.ensureOrganizerExists('user-1', 'John');

      // Should only call from once (for getOrganizerById)
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should handle null name parameter', async () => {
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      const createQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-1', name: null, created_at: '2023-01-01T00:00:00Z' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(createQueryChain as ReturnType<typeof mockSupabase.from>);

      await organizerService.ensureOrganizerExists('user-1', null);

      expect(createQueryChain.insert).toHaveBeenCalledWith({
        id: 'user-1',
        name: null,
      });
    });

    it('should handle undefined name parameter', async () => {
      const getQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      const createQueryChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'user-1', name: null, created_at: '2023-01-01T00:00:00Z' },
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(getQueryChain as ReturnType<typeof mockSupabase.from>)
        .mockReturnValueOnce(createQueryChain as ReturnType<typeof mockSupabase.from>);

      await organizerService.ensureOrganizerExists('user-1');

      expect(createQueryChain.insert).toHaveBeenCalledWith({
        id: 'user-1',
        name: null,
      });
    });
  });
});
