import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import type { FeatureFlagKey, FeatureFlags, FeatureFlagContext } from '@/types/feature-flags';
import { DEFAULT_FEATURE_FLAGS } from '@/types/feature-flags';

// Database row types
type FeatureFlagRow = Database['public']['Tables']['feature_flags']['Row'];
type FeatureFlagOverrideRow = Database['public']['Tables']['feature_flag_overrides']['Row'];

// Cache configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  flags: FeatureFlags;
  timestamp: number;
}

// Simple in-memory cache
const cache = new Map<string, CacheEntry>();

// Helper to generate cache key
function getCacheKey(context?: FeatureFlagContext): string {
  const userId = context?.userId || 'anon';
  const groupIds = context?.groupIds?.sort().join(',') || 'none';
  return `${userId}:${groupIds}`;
}

// Helper to check if cache is valid
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

export const featureFlagService = {
  /**
   * Fetches all feature flags with their resolved values for the given context
   * @param context - User and group context for resolving flags
   * @returns Resolved feature flags
   */
  async fetchFeatureFlags(context?: FeatureFlagContext): Promise<FeatureFlags> {
    // Check cache first
    const cacheKey = getCacheKey(context);
    const cached = cache.get(cacheKey);
    if (cached && isCacheValid(cached)) {
      return cached.flags;
    }

    // Fetch platform-wide defaults
    const { data: platformFlags, error: platformError } = await supabase
      .from('feature_flags')
      .select('*');

    if (platformError) {
      console.error('Error fetching feature flags:', platformError);
      return DEFAULT_FEATURE_FLAGS;
    }

    // Start with platform defaults
    const resolvedFlags: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

    // Apply platform-wide flag values
    if (platformFlags) {
      platformFlags.forEach((flag: FeatureFlagRow) => {
        const key = flag.key as FeatureFlagKey;
        if (key in resolvedFlags) {
          resolvedFlags[key] = flag.enabled;
        }
      });
    }

    // If we have user or group context, fetch and apply overrides
    if (context?.userId || context?.groupIds?.length) {
      const { data: overrides, error: overridesError } = await supabase
        .from('feature_flag_overrides')
        .select('*')
        .or(
          [
            context.userId ? `user_id.eq.${context.userId}` : null,
            context.groupIds?.length ? `group_id.in.(${context.groupIds.join(',')})` : null,
          ]
            .filter(Boolean)
            .join(',')
        );

      if (!overridesError && overrides) {
        // Apply overrides with proper precedence:
        // 1. Group overrides (first match)
        // 2. User overrides (highest precedence)

        // Apply group overrides first
        const groupOverrides = overrides.filter((o: FeatureFlagOverrideRow) => o.group_id !== null);
        groupOverrides.forEach((override: FeatureFlagOverrideRow) => {
          const key = override.feature_flag_key as FeatureFlagKey;
          if (key in resolvedFlags) {
            resolvedFlags[key] = override.enabled;
          }
        });

        // Apply user overrides last (highest precedence)
        const userOverrides = overrides.filter((o: FeatureFlagOverrideRow) => o.user_id !== null);
        userOverrides.forEach((override: FeatureFlagOverrideRow) => {
          const key = override.feature_flag_key as FeatureFlagKey;
          if (key in resolvedFlags) {
            resolvedFlags[key] = override.enabled;
          }
        });
      }
    }

    // Update cache
    cache.set(cacheKey, {
      flags: resolvedFlags,
      timestamp: Date.now(),
    });

    return resolvedFlags;
  },

  /**
   * Checks if a specific feature is enabled for the given context
   * @param key - Feature flag key to check
   * @param context - User and group context
   * @returns Whether the feature is enabled
   */
  async isFeatureEnabled(key: FeatureFlagKey, context?: FeatureFlagContext): Promise<boolean> {
    const flags = await this.fetchFeatureFlags(context);
    return flags[key] ?? DEFAULT_FEATURE_FLAGS[key];
  },

  /**
   * Invalidates the cache for a specific context or all contexts
   * @param context - Optional context to invalidate (if not provided, clears all cache)
   */
  invalidateCache(context?: FeatureFlagContext): void {
    if (context) {
      const cacheKey = getCacheKey(context);
      cache.delete(cacheKey);
    } else {
      cache.clear();
    }
  },
};
