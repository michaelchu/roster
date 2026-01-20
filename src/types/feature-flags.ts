// Feature flag keys - union type of all available feature flags
export type FeatureFlagKey =
  | 'groups_feature'
  | 'csv_export'
  | 'registration_form'
  | 'event_duplication'
  | 'home_page'
  | 'notifications'
  | 'event_privacy'
  | 'guest_registration';

// Feature flags interface mapping keys to boolean values
export interface FeatureFlags {
  groups_feature: boolean;
  csv_export: boolean;
  registration_form: boolean;
  event_duplication: boolean;
  home_page: boolean;
  notifications: boolean;
  event_privacy: boolean;
  guest_registration: boolean;
}

// Default feature flag values - all disabled by default as fallback
// The database is the source of truth for actual values
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  groups_feature: false,
  csv_export: false,
  registration_form: false,
  event_duplication: false,
  home_page: false,
  notifications: false,
  event_privacy: false,
  guest_registration: false,
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
