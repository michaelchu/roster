import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { featureFlagService } from '@/services/featureFlagService';
import type { FeatureFlags, FeatureFlagKey } from '@/types/feature-flags';
import { DEFAULT_FEATURE_FLAGS } from '@/types/feature-flags';

interface FeatureFlagsContextType {
  flags: FeatureFlags;
  loading: boolean;
  isFeatureEnabled: (key: FeatureFlagKey) => boolean;
  refreshFlags: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

// Auto-refresh interval (5 minutes)
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [loading, setLoading] = useState(true);

  // Fetch feature flags with current user context
  const fetchFlags = useCallback(async () => {
    try {
      const context = user?.id ? { userId: user.id } : undefined;
      const fetchedFlags = await featureFlagService.fetchFeatureFlags(context);
      setFlags(fetchedFlags);
    } catch (error) {
      console.error('Error fetching feature flags:', error);
      // Fall back to defaults on error
      setFlags(DEFAULT_FEATURE_FLAGS);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial fetch on mount and when user changes
  useEffect(() => {
    setLoading(true);
    fetchFlags();
  }, [fetchFlags]);

  // Set up auto-refresh polling
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchFlags();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [fetchFlags]);

  // Helper to check if a feature is enabled
  const isFeatureEnabled = useCallback(
    (key: FeatureFlagKey): boolean => {
      return flags[key] ?? DEFAULT_FEATURE_FLAGS[key];
    },
    [flags]
  );

  // Manual refresh function
  const refreshFlags = useCallback(async () => {
    await fetchFlags();
  }, [fetchFlags]);

  return (
    <FeatureFlagsContext.Provider
      value={{
        flags,
        loading,
        isFeatureEnabled,
        refreshFlags,
      }}
    >
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Hook to access all feature flags
 * @returns Feature flags context with all flags and helper functions
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFeatureFlags(): FeatureFlagsContextType {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagsProvider');
  }
  return context;
}

/**
 * Hook to check if a specific feature is enabled
 * @param key - Feature flag key to check
 * @returns Whether the feature is enabled
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const { flags } = useFeatureFlags();
  return flags[key] ?? DEFAULT_FEATURE_FLAGS[key];
}
