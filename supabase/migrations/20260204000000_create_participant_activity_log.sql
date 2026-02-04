-- Create participant_activity_log table for tracking participant activity history
-- This allows organizers to see a timeline of all participant actions for an event

CREATE TABLE participant_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,

  -- Activity type
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'joined',           -- Participant created/joined the event
    'withdrew',         -- Participant was deleted
    'payment_updated',  -- Payment status changed
    'info_updated',     -- Name, email, phone, or notes changed
    'label_added',      -- Label was assigned
    'label_removed'     -- Label was unassigned
  )),

  -- Participant name at time of activity (for display after participant is deleted)
  participant_name TEXT NOT NULL,

  -- Details about the change (JSONB for flexibility)
  -- E.g., {"from": "pending", "to": "paid"} or {"label_name": "VIP"}
  details JSONB DEFAULT '{}'::jsonb,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient queries
CREATE INDEX idx_participant_activity_event
  ON participant_activity_log(event_id, created_at DESC);
CREATE INDEX idx_participant_activity_participant
  ON participant_activity_log(participant_id, created_at DESC);
CREATE INDEX idx_participant_activity_type
  ON participant_activity_log(activity_type);

-- Enable RLS
ALTER TABLE participant_activity_log ENABLE ROW LEVEL SECURITY;

-- Organizers can view activity for their events
CREATE POLICY "Organizers can view activity for their events"
  ON participant_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = participant_activity_log.event_id
      AND events.organizer_id = auth.uid()
    )
  );
