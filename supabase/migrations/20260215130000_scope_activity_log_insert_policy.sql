-- Replace the overly permissive INSERT policy on participant_activity_log
-- with a scoped policy that only allows event organizers and participants.
--
-- The previous policy (WITH CHECK (true)) allowed any authenticated user to
-- insert activity log entries for any event. This scoped policy restricts
-- inserts to users who are actually involved with the event:
--   1. Event organizers (for payment updates, label changes, etc.)
--   2. Participants who claimed a spot (for join/withdraw logging)
--
-- The SECURITY DEFINER RPC (log_participant_activity) is kept for its
-- server-side validation, but we don't rely on it bypassing RLS since
-- that behavior is inconsistent across Supabase environments.

DROP POLICY "Authenticated users can insert activity logs" ON participant_activity_log;

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
