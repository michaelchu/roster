-- Add INSERT policy for participant_activity_log table
-- The triggers that used to insert activity logs were removed in favor of service layer
-- but the INSERT policy was missing, causing RLS violations

-- Organizers can insert activity for their events
CREATE POLICY "Organizers can insert activity for their events"
  ON participant_activity_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = participant_activity_log.event_id
      AND events.organizer_id = auth.uid()
    )
  );
