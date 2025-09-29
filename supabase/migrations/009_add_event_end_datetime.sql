-- Add end_datetime field to events table
-- This migration adds support for event end times alongside existing start times
-- The end_datetime field is optional and should be after the start datetime when provided

-- Add end_datetime column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ;

-- Add check constraint to ensure end_datetime is after datetime when both are provided
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_end_datetime_after_start') THEN
        ALTER TABLE events ADD CONSTRAINT events_end_datetime_after_start
        CHECK (end_datetime IS NULL OR datetime IS NULL OR end_datetime > datetime);
    END IF;
END $$;

-- Add index for performance on end_datetime queries
CREATE INDEX IF NOT EXISTS idx_events_end_datetime ON events(end_datetime);

-- Add comment for documentation
COMMENT ON COLUMN events.end_datetime IS 'Optional end date and time for the event. Must be after the start datetime when provided.';