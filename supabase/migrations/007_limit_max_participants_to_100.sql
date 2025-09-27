-- Limit max participants to 100 instead of 10,000
-- This migration updates the max_participants constraint to be more reasonable for typical events

-- Drop the existing constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_max_participants_check;

-- Add new constraint with updated limit
ALTER TABLE events ADD CONSTRAINT events_max_participants_check
    CHECK (max_participants > 0 AND max_participants <= 100);