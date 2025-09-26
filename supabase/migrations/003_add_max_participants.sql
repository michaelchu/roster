-- Add max_participants column to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS max_participants INTEGER DEFAULT 50 CHECK (max_participants > 0 AND max_participants <= 999);

-- Add comment to explain the column
COMMENT ON COLUMN events.max_participants IS 'Maximum number of participants allowed for this event';
