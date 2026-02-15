-- Add a scoped INSERT policy for participant_activity_log.
--
-- The SECURITY DEFINER RPC function (log_participant_activity) should bypass RLS,
-- but in some Supabase environments the function owner's role does not bypass RLS
-- as expected, causing error 42501 when participants sign up or withdraw.
--
-- This policy allows event organizers and participants to insert activity log
-- entries for events they're involved with:
--   1. Event organizers (for payment updates, label changes, etc.)
--   2. Participants who claimed a spot (for join/withdraw logging)
--
-- The SECURITY DEFINER RPC is kept for its server-side validation, but we
-- don't rely on it bypassing RLS since that behavior is inconsistent across
-- Supabase environments.

CREATE POLICY "Event organizers and participants can insert activity logs"
  ON participant_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is the event organizer
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = participant_activity_log.event_id
      AND events.organizer_id = auth.uid()
    )
    OR
    -- User is a participant in the event (claimed a spot)
    EXISTS (
      SELECT 1 FROM participants
      WHERE participants.event_id = participant_activity_log.event_id
      AND participants.claimed_by_user_id = auth.uid()
    )
  );
