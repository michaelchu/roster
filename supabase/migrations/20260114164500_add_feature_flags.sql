-- Add feature flags system for platform-wide and user/group level feature toggles

-- 1. Create feature_flags table for platform-wide defaults
CREATE TABLE public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for fast key lookups
CREATE INDEX idx_feature_flags_key ON public.feature_flags(key);

-- 2. Create feature_flag_overrides table for user and group level overrides
CREATE TABLE public.feature_flag_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_flag_key TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES public.groups(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure exactly one of user_id or group_id is set
    CONSTRAINT check_override_target CHECK (
        (user_id IS NOT NULL AND group_id IS NULL) OR
        (user_id IS NULL AND group_id IS NOT NULL)
    ),
    
    -- Ensure unique overrides per user and per group
    CONSTRAINT unique_user_override UNIQUE (feature_flag_key, user_id),
    CONSTRAINT unique_group_override UNIQUE (feature_flag_key, group_id)
);

-- Add indexes for fast lookups
CREATE INDEX idx_feature_flag_overrides_key ON public.feature_flag_overrides(feature_flag_key);
CREATE INDEX idx_feature_flag_overrides_user_id ON public.feature_flag_overrides(user_id);
CREATE INDEX idx_feature_flag_overrides_group_id ON public.feature_flag_overrides(group_id);

-- 3. Enable RLS on both tables
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for feature_flags table
-- All authenticated users can read feature flags
CREATE POLICY "Authenticated users can read feature flags"
    ON public.feature_flags
    FOR SELECT
    TO authenticated
    USING (true);

-- Anonymous users can also read feature flags (for public features)
CREATE POLICY "Anonymous users can read feature flags"
    ON public.feature_flags
    FOR SELECT
    TO anon
    USING (true);

-- Only service role can modify feature flags (admin only)
-- This is implicitly enforced since we don't create INSERT/UPDATE/DELETE policies for authenticated users

-- 5. Create RLS policies for feature_flag_overrides table
-- Users can read their own overrides
CREATE POLICY "Users can read their own overrides"
    ON public.feature_flag_overrides
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Users can read overrides for groups they belong to
CREATE POLICY "Users can read group overrides"
    ON public.feature_flag_overrides
    FOR SELECT
    TO authenticated
    USING (
        group_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.group_participants
            WHERE group_participants.group_id = feature_flag_overrides.group_id
            AND group_participants.participant_id IN (
                SELECT id FROM public.participants
                WHERE claimed_by_user_id = auth.uid()
            )
        )
    );

-- Only service role can modify overrides (admin only)
-- This is implicitly enforced since we don't create INSERT/UPDATE/DELETE policies for authenticated users

-- 6. Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON public.feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_flag_overrides_updated_at
    BEFORE UPDATE ON public.feature_flag_overrides
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Seed initial feature flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
    ('csv_export', true, 'Controls CSV export feature - allows organizers to export participant lists'),
    ('event_duplication', true, 'Controls event duplication feature - allows organizers to duplicate events');

-- 8. Add comments for documentation
COMMENT ON TABLE public.feature_flags IS 'Platform-wide feature flag defaults';
COMMENT ON TABLE public.feature_flag_overrides IS 'User and group level feature flag overrides';
COMMENT ON COLUMN public.feature_flags.key IS 'Unique identifier for the feature flag (e.g., groups_feature, csv_export)';
COMMENT ON COLUMN public.feature_flags.enabled IS 'Platform-wide default value for this flag';
COMMENT ON COLUMN public.feature_flag_overrides.user_id IS 'User-specific override (mutually exclusive with group_id)';
COMMENT ON COLUMN public.feature_flag_overrides.group_id IS 'Group-specific override (mutually exclusive with user_id)';
COMMENT ON COLUMN public.feature_flag_overrides.enabled IS 'Override value for this user or group';
