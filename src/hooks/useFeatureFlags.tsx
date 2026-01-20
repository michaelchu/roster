import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { featureFlagService } from '@/services/featureFlagService';
import type { FeatureFlags, FeatureFlagKey } from '@/types/feature-flags';

interface FeatureFlagsContextType {
  flags: FeatureFlags | null;
  loading: boolean;
  error: Error | null;
  isFeatureEnabled: (key: FeatureFlagKey) => boolean;
  refreshFlags: () => Promise<void>;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(undefined);

// Auto-refresh interval (5 minutes)
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch feature flags with current user context
  const fetchFlags = useCallback(async () => {
    try {
      const context = user?.id ? { userId: user.id } : undefined;
      const fetchedFlags = await featureFlagService.fetchFeatureFlags(context);
      setFlags(fetchedFlags);
      setError(null);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch feature flags');
      setError(fetchError);
      // Don't clear flags on refresh errors if we already have them cached
      // This allows the app to keep working with stale flags during transient errors
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
      if (!flags) return false;
      return flags[key];
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
        error,
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
 * @returns Whether the feature is enabled (false if flags haven't loaded yet)
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  const { flags, error } = useFeatureFlags();

  // If there's an error and no cached flags, throw to trigger error boundary
  if (error && !flags) {
    throw error;
  }

  // Return false while loading or if flag doesn't exist
  if (!flags) return false;
  return flags[key];
}
