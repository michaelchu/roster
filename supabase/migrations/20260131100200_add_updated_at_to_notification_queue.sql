-- Migration: Add updated_at column to notification_queue table
-- This enables tracking when items were last modified, which is needed for
-- the stale item cleanup mechanism in the send-push Edge Function

-- Add updated_at column with default value and NOT NULL constraint
-- No backfill needed as this is a new feature with no existing data
ALTER TABLE notification_queue
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Create trigger to automatically update the updated_at timestamp
-- Depends on update_updated_at_column() function from migration 20260114164500_add_feature_flags.sql
-- If that migration hasn't run, this will fail - ensure migrations are run in order
CREATE TRIGGER update_notification_queue_updated_at
    BEFORE UPDATE ON notification_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment explaining the column
COMMENT ON COLUMN notification_queue.updated_at IS 'Timestamp of last modification. Used by send-push Edge Function to detect stale processing items (stuck for >5 minutes).';
