-- Add event_privacy feature flag
INSERT INTO public.feature_flags (key, enabled, description) VALUES
    ('event_privacy', false, 'Controls visibility of event privacy settings - when enabled, allows organizers to set events as private');
