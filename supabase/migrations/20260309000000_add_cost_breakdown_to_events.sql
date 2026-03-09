-- Add cost_breakdown JSONB column to events table
-- Schema: { items: [{ label, quantity, cost }], participant_count, cost_per_person }
ALTER TABLE events ADD COLUMN cost_breakdown JSONB DEFAULT NULL;
