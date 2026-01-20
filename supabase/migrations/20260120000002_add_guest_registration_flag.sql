-- Add guest_registration feature flag
INSERT INTO public.feature_flags (key, enabled, description) VALUES
    ('guest_registration', false, 'Allows users to claim additional spots for guests (+1s) they are bringing to events');
