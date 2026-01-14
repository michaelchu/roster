// Feature flag keys - union type of all available feature flags
export type FeatureFlagKey =
  | 'groups_feature'
  | 'csv_export'
  | 'quick_fill'
  | 'event_duplication'
  | 'home_page';

// Feature flags interface mapping keys to boolean values
export interface FeatureFlags {
  groups_feature: boolean;
  csv_export: boolean;
  quick_fill: boolean;
  event_duplication: boolean;
  home_page: boolean;
}

// Default feature flag values
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  groups_feature: true,
  csv_export: true,
  quick_fill: true,
  event_duplication: true,
  home_page: true,
};

// Database types for feature flags
export interface FeatureFlag {
  id: string;
  key: FeatureFlagKey;
  enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlagOverride {
  id: string;
  feature_flag_key: FeatureFlagKey;
  user_id: string | null;
  group_id: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Context for resolving feature flags
export interface FeatureFlagContext {
  userId?: string;
  groupIds?: string[];
}
