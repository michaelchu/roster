-- Migration: Add updated_at column to notification_queue table
-- This enables tracking when items were last modified, which is needed for
-- the stale item cleanup mechanism in the send-push Edge Function

-- Add updated_at column with default value
ALTER TABLE notification_queue
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows: set updated_at to created_at for existing records
UPDATE notification_queue
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Make the column NOT NULL after backfilling
ALTER TABLE notification_queue
ALTER COLUMN updated_at SET NOT NULL;

-- Create trigger to automatically update the updated_at timestamp
-- The update_updated_at_column() function already exists from the feature_flags migration
CREATE TRIGGER update_notification_queue_updated_at
    BEFORE UPDATE ON notification_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment explaining the column
COMMENT ON COLUMN notification_queue.updated_at IS 'Timestamp of last modification. Used by send-push Edge Function to detect stale processing items (stuck for >5 minutes).';
