-- Remove the notifications feature flag since notifications are now always enabled
-- Users can control their notification preferences via the notification_preferences table

DELETE FROM public.feature_flag_overrides WHERE feature_flag_key = 'notifications';
DELETE FROM public.feature_flags WHERE key = 'notifications';
