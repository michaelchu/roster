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
    it('should throw error when fetch fails', async () => {
      const mockError = { message: 'Database error' };
      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: null, error: mockError }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(featureFlagService.fetchFeatureFlags()).rejects.toThrow(
        'Failed to fetch feature flags: Database error'
      );
    });

    it('should throw error when no flags returned', async () => {
      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      await expect(featureFlagService.fetchFeatureFlags()).rejects.toThrow(
        'No feature flags returned from database'
      );
    });

    it('should return platform flags when no context provided', async () => {
      const platformFlags = [
        { key: 'groups_feature', enabled: true },
        { key: 'csv_export', enabled: true },
        { key: 'registration_form', enabled: false },
      ];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await featureFlagService.fetchFeatureFlags();

      expect(result.groups_feature).toBe(true);
      expect(result.csv_export).toBe(true);
      expect(result.registration_form).toBe(false);
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
      const platformFlags = [{ key: 'registration_form', enabled: false }];

      const overrides = [
        {
          feature_flag_key: 'registration_form',
          user_id: null,
          group_id: 'group-456',
          enabled: true,
        },
        {
          feature_flag_key: 'registration_form',
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
      expect(result.registration_form).toBe(false);
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

    it('should include unknown flag keys from database', async () => {
      const platformFlags = [
        { key: 'groups_feature', enabled: true },
        { key: 'unknown_flag', enabled: true }, // Unknown key - will be included
      ];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await featureFlagService.fetchFeatureFlags();

      expect(result.groups_feature).toBe(true);
      // Unknown flags are included since we build from DB directly now
      expect((result as any).unknown_flag).toBe(true);
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

    it('should return undefined for unspecified flag', async () => {
      const platformFlags: any[] = [];

      const mockQueryChain = {
        select: vi.fn().mockResolvedValue({ data: platformFlags, error: null }),
      };

      mockSupabase.from.mockReturnValue(mockQueryChain as any);

      const result = await featureFlagService.isFeatureEnabled('home_page');

      expect(result).toBeUndefined();
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
});
