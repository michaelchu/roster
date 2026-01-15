-- Add notifications feature flag
INSERT INTO public.feature_flags (key, enabled, description) VALUES
    ('notifications', false, 'Controls visibility of notifications settings - when enabled, shows email and SMS notification preferences');
