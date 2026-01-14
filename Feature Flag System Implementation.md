# Feature Flag System Implementation
## Problem Statement
The roster app needs a feature flag system to control feature rollout at the platform level. This will enable gradual feature releases and A/B testing without requiring code deployments.
## Current State
* React + TypeScript app using Supabase for backend
* Authentication via Supabase Auth with user sessions
* Type-safe database access via generated types (src/types/supabase.ts)
* Context pattern already used (useAuth hook in src/hooks/useAuth.tsx)
* No existing feature flag infrastructure
## Proposed Changes
### 1. Database Layer
Create new migration: `016_add_feature_flags.sql`
* `feature_flags` table (platform-wide defaults):
    * `id` (UUID, primary key)
    * `key` (TEXT, unique, not null) - flag identifier (e.g., 'groups_feature', 'csv_export')
    * `enabled` (BOOLEAN, default false) - platform-wide default
    * `description` (TEXT) - human-readable description
    * `created_at` (TIMESTAMPTZ)
    * `updated_at` (TIMESTAMPTZ)
* `feature_flag_overrides` table (user and group level overrides):
    * `id` (UUID, primary key)
    * `feature_flag_key` (TEXT, not null) - references feature_flags(key)
    * `user_id` (UUID, nullable) - references organizers(id), for user-specific overrides
    * `group_id` (UUID, nullable) - references groups(id), for group-specific overrides
    * `enabled` (BOOLEAN, not null) - override value
    * `created_at` (TIMESTAMPTZ)
    * `updated_at` (TIMESTAMPTZ)
    * Constraint: exactly one of user_id or group_id must be non-null
    * Unique constraint on (feature_flag_key, user_id) and (feature_flag_key, group_id)
* Add RLS policies:
    * feature_flags: read access for all authenticated users, write access admin only
    * feature_flag_overrides: users can read their own and their groups' overrides, write access admin only
* Create indexes on key, user_id, and group_id columns
### 2. TypeScript Types
Update src/types/supabase.ts to include new feature_flags table types (or regenerate from Supabase CLI if available)
Create src/types/feature-flags.ts:
* `FeatureFlagKey` type (union of all flag keys)
* `FeatureFlags` interface mapping keys to boolean values
* Default flag values configuration
### 3. Feature Flag Service
Create src/services/featureFlagService.ts:
* `fetchFeatureFlags(userId?, groupIds?)` - fetches flags with user/group context
* `isFeatureEnabled(key, userId?, groupId?)` - checks flag with precedence:
    1. User-specific override (if userId provided)
    2. Group-specific override (if groupId provided, uses first match if multiple groups)
    3. Platform-wide default
* `getFeatureFlagValue(key, context)` - resolves flag value with full context
* Caching mechanism with configurable TTL (default 5 minutes)
* Cache invalidation on override changes
Note: All flag values come from database only - no environment variable overrides
### 4. React Context & Hook
Create src/hooks/useFeatureFlags.tsx:
* `FeatureFlagsProvider` component that wraps the app
* Integrates with AuthProvider to get current user context
* Fetches platform flags, user-specific overrides, and group-specific overrides on mount
* Auto-refresh mechanism (polling every 5 minutes)
* `useFeatureFlag(key)` hook - automatically resolves with current user/group context
* `useFeatureFlags()` hook - returns all resolved flags for current user
* `isFeatureEnabled(key)` helper - checks flag value with proper precedence
### 5. Integration
Update src/App.tsx:
* Wrap app with `FeatureFlagsProvider` (after AuthProvider)
### 6. Initial Flags
Seed initial feature flags in migration:
* `groups_feature` - Controls groups functionality (enabled by default)
* `csv_export` - Controls CSV export feature (enabled by default)
* `quick_fill` - Controls localStorage-based quick fill (enabled by default)
* `event_duplication` - Controls event duplication feature (enabled by default)
### 7. User/Group Override Management
Create helper functions in featureFlagService.ts for managing overrides:
* `setUserOverride(userId, flagKey, enabled)` - sets user-specific override
* `setGroupOverride(groupId, flagKey, enabled)` - sets group-specific override
* `removeUserOverride(userId, flagKey)` - removes user override (falls back to group/platform)
* `removeGroupOverride(groupId, flagKey)` - removes group override (falls back to platform)
Note: These will require elevated permissions (service role or admin user)
### 8. Testing Strategy
* Test flag resolution with different precedence levels
* Test caching behavior
* Test environment variable overrides
* Verify RLS policies work correctly for different user contexts
