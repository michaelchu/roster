import { describe, it, beforeEach, expect, vi } from 'vitest';

// Mock Supabase - must be hoisted
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
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
    it('should return organizer data from RPC', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            id: 'user-1',
            name: 'John Doe',
            email: 'john@example.com',
            created_at: '2023-01-01T00:00:00Z',
          },
        ],
        error: null,
      });

      const result = await organizerService.getOrganizerById('user-1');

      expect(result).toEqual({
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        created_at: '2023-01-01T00:00:00Z',
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_profile', { user_id: 'user-1' });
    });

    it('should return null on error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await organizerService.getOrganizerById('nonexistent');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith('Error fetching organizer', {
        message: 'Not found',
      });
    });

    it('should return null when no data returned', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await organizerService.getOrganizerById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getOrganizerDisplayName', () => {
    it('should return display name from RPC', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 'John Doe',
        error: null,
      });

      const result = await organizerService.getOrganizerDisplayName('user-1');

      expect(result).toBe('John Doe');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_user_display_name', { user_id: 'user-1' });
    });

    it('should return "Unknown" on error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await organizerService.getOrganizerDisplayName('nonexistent');

      expect(result).toBe('Unknown');
      expect(console.error).toHaveBeenCalledWith('Error fetching organizer display name', {
        message: 'Not found',
      });
    });
  });
});
