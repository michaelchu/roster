-- Rename quick_fill feature flag to registration_form
UPDATE public.feature_flags
SET key = 'registration_form',
    description = 'Controls registration form - when disabled, Join Event directly signs up the user and Modify Registration becomes Withdraw'
WHERE key = 'quick_fill';

-- Also update any overrides that reference this flag
UPDATE public.feature_flag_overrides
SET feature_flag_key = 'registration_form'
WHERE feature_flag_key = 'quick_fill';
