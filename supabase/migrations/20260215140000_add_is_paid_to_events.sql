-- Add is_paid column to events table
-- Defaults to true (paid) since most events are expected to be paid
ALTER TABLE events ADD COLUMN is_paid boolean NOT NULL DEFAULT true;
