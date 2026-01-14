-- Add home_page feature flag
INSERT INTO public.feature_flags (key, enabled, description) VALUES
    ('home_page', false, 'Controls visibility of home page - when disabled, shows coming soon message');
