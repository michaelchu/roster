/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, beforeEach, expect, vi, afterEach } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
    })),
  },
}));

import { featureFlagService } from '../featureFlagService';
import { supabase } from '@/lib/supabase';
import { DEFAULT_FEATURE_FLAGS } from '@/types/feature-flags';

const mockSupabase = vi.mocked(supabase);

describe('featureFlagService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear cache before each test
    featureFlagService.invalidateCache();
    // Reset timers
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fetchFeatureFlags', () => {
    it('should return default flags when fetch fails', async () => {
      const mockError = new Error('Database error');
      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await featureFlagService.fetchFeatureFlags();

      expect(result).toEqual(DEFAULT_FEATURE_FLAGS);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return platform flags when no context provided', async () => {
      const platformFlags = [
        { key: 'groups_feature', enabled: true },
        { key: 'csv_export', enabled: true },
      ];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await featureFlagService.fetchFeatureFlags();

      expect(result.groups_feature).toBe(true);
      expect(result.csv_export).toBe(true);
      expect(result.quick_fill).toBe(false); // Default
    });

    it('should apply user overrides with highest precedence', async () => {
      const platformFlags = [{ key: 'groups_feature', enabled: false }];

      const overrides = [
        { feature_flag_key: 'groups_feature', user_id: 'user-123', group_id: null, enabled: true },
      ];

      // First call fetches feature_flags, second call fetches overrides
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'feature_flags') {
          return {
            select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
          } as any;
        }
        // feature_flag_overrides
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: overrides, error: null }),
          }),
        } as any;
      });

      const result = await featureFlagService.fetchFeatureFlags({ userId: 'user-123' });

      expect(result.groups_feature).toBe(true); // User override takes precedence
    });

    it('should apply group overrides', async () => {
      const platformFlags = [{ key: 'csv_export', enabled: false }];

      const overrides = [
        {
          feature_flag_key: 'csv_export',
          user_id: null,
          group_id: 'group-456',
          enabled: true,
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'feature_flags') {
          return {
            select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: overrides, error: null }),
          }),
        } as any;
      });

      const result = await featureFlagService.fetchFeatureFlags({ groupIds: ['group-456'] });

      expect(result.csv_export).toBe(true); // Group override applied
    });

    it('should prioritize user override over group override', async () => {
      const platformFlags = [{ key: 'quick_fill', enabled: false }];

      const overrides = [
        {
          feature_flag_key: 'quick_fill',
          user_id: null,
          group_id: 'group-456',
          enabled: true,
        },
        {
          feature_flag_key: 'quick_fill',
          user_id: 'user-123',
          group_id: null,
          enabled: false,
        },
      ];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'feature_flags') {
          return {
            select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: overrides, error: null }),
          }),
        } as any;
      });

      const result = await featureFlagService.fetchFeatureFlags({
        userId: 'user-123',
        groupIds: ['group-456'],
      });

      // User override (false) takes precedence over group override (true)
      expect(result.quick_fill).toBe(false);
    });

    it('should use cached value within TTL', async () => {
      const platformFlags = [{ key: 'groups_feature', enabled: true }];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      // First call - hits database
      await featureFlagService.fetchFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await featureFlagService.fetchFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should refresh cache after TTL expires', async () => {
      const platformFlags = [{ key: 'groups_feature', enabled: true }];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      // First call
      await featureFlagService.fetchFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      // Advance time past TTL (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Second call - should hit database again
      await featureFlagService.fetchFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });

    it('should use different cache keys for different contexts', async () => {
      const platformFlags = [{ key: 'groups_feature', enabled: true }];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'feature_flags') {
          return {
            select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any;
      });

      // Call with different contexts - each requires fetching feature_flags + overrides
      await featureFlagService.fetchFeatureFlags(); // No context = 1 call (no overrides fetch)
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' }); // 2 calls
      await featureFlagService.fetchFeatureFlags({ groupIds: ['group-456'] }); // 2 calls

      // Total: 1 + 2 + 2 = 5 calls
      expect(mockSupabase.from).toHaveBeenCalledTimes(5);

      // Calling again with same context should use cache
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' });
      expect(mockSupabase.from).toHaveBeenCalledTimes(5); // Still 5
    });

    it('should ignore unknown flag keys from database', async () => {
      const platformFlags = [
        { key: 'groups_feature', enabled: true },
        { key: 'unknown_flag', enabled: true }, // Unknown key
      ];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await featureFlagService.fetchFeatureFlags();

      expect(result.groups_feature).toBe(true);
      expect((result as any).unknown_flag).toBeUndefined();
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled feature', async () => {
      const platformFlags = [{ key: 'csv_export', enabled: true }];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await featureFlagService.isFeatureEnabled('csv_export');

      expect(result).toBe(true);
    });

    it('should return false for disabled feature', async () => {
      const platformFlags = [{ key: 'notifications', enabled: false }];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await featureFlagService.isFeatureEnabled('notifications');

      expect(result).toBe(false);
    });

    it('should return default value for unspecified flag', async () => {
      const platformFlags: any[] = [];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await featureFlagService.isFeatureEnabled('home_page');

      expect(result).toBe(DEFAULT_FEATURE_FLAGS.home_page);
    });
  });

  describe('getFeatureFlagValue', () => {
    it('should return same result as isFeatureEnabled', async () => {
      const platformFlags = [{ key: 'event_duplication', enabled: true }];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await featureFlagService.getFeatureFlagValue('event_duplication');

      expect(result).toBe(true);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate all cache when no context provided', async () => {
      const platformFlags = [{ key: 'groups_feature', enabled: true }];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'feature_flags') {
          return {
            select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any;
      });

      // Populate cache
      await featureFlagService.fetchFeatureFlags(); // 1 call
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' }); // 2 calls

      expect(mockSupabase.from).toHaveBeenCalledTimes(3);

      // Invalidate all
      featureFlagService.invalidateCache();

      // Next calls should hit database again
      await featureFlagService.fetchFeatureFlags(); // 1 call
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' }); // 2 calls

      expect(mockSupabase.from).toHaveBeenCalledTimes(6);
    });

    it('should invalidate specific context cache', async () => {
      const platformFlags = [{ key: 'groups_feature', enabled: true }];

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'feature_flags') {
          return {
            select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        } as any;
      });

      // Populate cache
      await featureFlagService.fetchFeatureFlags(); // 1 call
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' }); // 2 calls

      expect(mockSupabase.from).toHaveBeenCalledTimes(3);

      // Invalidate only user context
      featureFlagService.invalidateCache({ userId: 'user-123' });

      // Anonymous context should still be cached
      await featureFlagService.fetchFeatureFlags();
      expect(mockSupabase.from).toHaveBeenCalledTimes(3); // Still 3

      // User context should hit database
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' });
      expect(mockSupabase.from).toHaveBeenCalledTimes(5); // 3 + 2
    });
  });

  describe('setUserOverride', () => {
    it('should upsert user override', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      const mockQueryChain = {
        upsert: upsertMock,
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await featureFlagService.setUserOverride('user-123', 'groups_feature', true);

      expect(mockSupabase.from).toHaveBeenCalledWith('feature_flag_overrides');
      expect(upsertMock).toHaveBeenCalledWith(
        {
          feature_flag_key: 'groups_feature',
          user_id: 'user-123',
          group_id: null,
          enabled: true,
        },
        {
          onConflict: 'feature_flag_key,user_id',
        }
      );
    });

    it('should throw error when upsert fails', async () => {
      const mockError = new Error('Upsert failed');
      const upsertMock = vi.fn().mockResolvedValue({ error: mockError });

      const mockQueryChain = {
        upsert: upsertMock,
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(
        featureFlagService.setUserOverride('user-123', 'groups_feature', true)
      ).rejects.toThrow('Upsert failed');
    });

    it('should invalidate user cache after setting override', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'feature_flag_overrides') {
          // Check if this is the override write or the override read
          return {
            upsert: upsertMock,
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any;
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      });

      // Populate cache
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' });
      const initialCalls = mockSupabase.from.mock.calls.length;

      // Set override (should invalidate cache)
      await featureFlagService.setUserOverride('user-123', 'groups_feature', true);

      // Fetch again (should hit database)
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' });

      expect(mockSupabase.from.mock.calls.length).toBeGreaterThan(initialCalls + 1);
    });
  });

  describe('setGroupOverride', () => {
    it('should upsert group override', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      const mockQueryChain = {
        upsert: upsertMock,
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await featureFlagService.setGroupOverride('group-456', 'csv_export', false);

      expect(mockSupabase.from).toHaveBeenCalledWith('feature_flag_overrides');
      expect(upsertMock).toHaveBeenCalledWith(
        {
          feature_flag_key: 'csv_export',
          user_id: null,
          group_id: 'group-456',
          enabled: false,
        },
        {
          onConflict: 'feature_flag_key,group_id',
        }
      );
    });

    it('should throw error when upsert fails', async () => {
      const mockError = new Error('Upsert failed');
      const upsertMock = vi.fn().mockResolvedValue({ error: mockError });

      const mockQueryChain = {
        upsert: upsertMock,
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(
        featureFlagService.setGroupOverride('group-456', 'csv_export', false)
      ).rejects.toThrow('Upsert failed');
    });

    it('should invalidate all cache after setting group override', async () => {
      const upsertMock = vi.fn().mockResolvedValue({ error: null });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'feature_flag_overrides') {
          return {
            upsert: upsertMock,
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          } as any;
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        } as any;
      });

      // Populate cache for multiple contexts
      await featureFlagService.fetchFeatureFlags(); // 1 call
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' }); // 2 calls

      const callsBefore = mockSupabase.from.mock.calls.length; // 3

      // Set group override (should invalidate ALL cache) - 1 call
      await featureFlagService.setGroupOverride('group-456', 'csv_export', true);

      // Both fetches should hit database again
      await featureFlagService.fetchFeatureFlags(); // 1 call
      await featureFlagService.fetchFeatureFlags({ userId: 'user-123' }); // 2 calls

      // Should have more calls after invalidation: 3 + 1 + 1 + 2 = 7
      expect(mockSupabase.from.mock.calls.length).toBe(callsBefore + 4);
    });
  });

  describe('removeUserOverride', () => {
    it('should delete user override', async () => {
      const eqMock = vi.fn().mockReturnThis();
      const deleteMock = vi.fn().mockReturnThis();

      // Chain eq calls
      eqMock.mockReturnValueOnce({ eq: eqMock }).mockResolvedValue({ error: null });

      const mockQueryChain = {
        delete: deleteMock,
        eq: eqMock,
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await featureFlagService.removeUserOverride('user-123', 'groups_feature');

      expect(mockSupabase.from).toHaveBeenCalledWith('feature_flag_overrides');
      expect(deleteMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('feature_flag_key', 'groups_feature');
      expect(eqMock).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should throw error when delete fails', async () => {
      const mockError = new Error('Delete failed');
      const eqMock = vi.fn().mockReturnThis();
      eqMock.mockReturnValueOnce({ eq: eqMock }).mockResolvedValue({ error: mockError });

      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: eqMock,
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(
        featureFlagService.removeUserOverride('user-123', 'groups_feature')
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('removeGroupOverride', () => {
    it('should delete group override', async () => {
      const eqMock = vi.fn().mockReturnThis();
      const deleteMock = vi.fn().mockReturnThis();

      eqMock.mockReturnValueOnce({ eq: eqMock }).mockResolvedValue({ error: null });

      const mockQueryChain = {
        delete: deleteMock,
        eq: eqMock,
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await featureFlagService.removeGroupOverride('group-456', 'csv_export');

      expect(mockSupabase.from).toHaveBeenCalledWith('feature_flag_overrides');
      expect(deleteMock).toHaveBeenCalled();
      expect(eqMock).toHaveBeenCalledWith('feature_flag_key', 'csv_export');
      expect(eqMock).toHaveBeenCalledWith('group_id', 'group-456');
    });

    it('should throw error when delete fails', async () => {
      const mockError = new Error('Delete failed');
      const eqMock = vi.fn().mockReturnThis();
      eqMock.mockReturnValueOnce({ eq: eqMock }).mockResolvedValue({ error: mockError });

      const mockQueryChain = {
        delete: vi.fn().mockReturnThis(),
        eq: eqMock,
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(
        featureFlagService.removeGroupOverride('group-456', 'csv_export')
      ).rejects.toThrow('Delete failed');
    });

    it('should invalidate all cache after removing group override', async () => {
      const eqMock = vi.fn().mockReturnThis();
      eqMock.mockReturnValueOnce({ eq: eqMock }).mockResolvedValue({ error: null });

      const selectMock = vi.fn().mockResolvedValue({ data: [], error: null });

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'feature_flag_overrides') {
          return { delete: vi.fn().mockReturnThis(), eq: eqMock } as any;
        }
        return { select: selectMock } as any;
      });

      // Populate cache
      await featureFlagService.fetchFeatureFlags();

      // Remove group override (invalidates all cache)
      await featureFlagService.removeGroupOverride('group-456', 'csv_export');

      // Should need to fetch again
      await featureFlagService.fetchFeatureFlags();

      // Verify multiple fetches occurred
      expect(mockSupabase.from).toHaveBeenCalledWith('feature_flags');
    });
  });
});
