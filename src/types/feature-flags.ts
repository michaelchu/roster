// Feature flag keys - union type of all available feature flags
export type FeatureFlagKey =
  | 'csv_export'
  | 'registration_form'
  | 'event_duplication'
  | 'home_page'
  | 'event_privacy'
  | 'guest_registration'
  | 'debug_notifications'
  | 'admin_tools';

// Feature flags interface mapping keys to boolean values
export interface FeatureFlags {
  csv_export: boolean;
  registration_form: boolean;
  event_duplication: boolean;
  home_page: boolean;
  event_privacy: boolean;
  guest_registration: boolean;
  debug_notifications: boolean;
  admin_tools: boolean;
}

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
