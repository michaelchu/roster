-- Add debug_notifications feature flag for testing notification triggers
-- This flag is disabled by default and should only be enabled for testers via user-level overrides

INSERT INTO public.feature_flags (key, enabled, description) VALUES
    ('debug_notifications', false, 'Debug panel for testing all notification types - enable per-user for testers');

-- Allow users to insert test notifications for themselves into the queue
-- This is guarded by the debug_notifications feature flag in the application
CREATE POLICY "Users can insert own test notifications"
    ON notification_queue FOR INSERT
    TO authenticated
    WITH CHECK (recipient_user_id = auth.uid());
