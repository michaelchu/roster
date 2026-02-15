-- Fix: Add user_id check to activity log INSERT policy
--
-- The previous scoped INSERT policy only checked claimed_by_user_id, but
-- self-registered participants have user_id set instead (claimed_by_user_id
-- is NULL for self-registration). This caused silent INSERT failures when
-- participants withdrew, because the SECURITY DEFINER RPC doesn't reliably
-- bypass RLS in all Supabase environments.
--
-- This migration drops and recreates the policy to also check user_id.

DROP POLICY IF EXISTS "Event organizers and participants can insert activity logs"
  ON participant_activity_log;

CREATE POLICY "Event organizers and participants can insert activity logs"
  ON participant_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (
    -- participant_id must belong to the event (or be null for deleted participants)
    (
      participant_activity_log.participant_id IS NULL
      OR EXISTS (
        SELECT 1 FROM participants
        WHERE participants.id = participant_activity_log.participant_id
        AND participants.event_id = participant_activity_log.event_id
      )
    )
    AND (
      -- User is the event organizer
      EXISTS (
        SELECT 1 FROM events
        WHERE events.id = participant_activity_log.event_id
        AND events.organizer_id = auth.uid()
      )
      OR
      -- User is the self-registered participant
      EXISTS (
        SELECT 1 FROM participants
        WHERE participants.id = participant_activity_log.participant_id
        AND participants.user_id = auth.uid()
      )
      OR
      -- User claimed this participant record on behalf of someone else
      EXISTS (
        SELECT 1 FROM participants
        WHERE participants.id = participant_activity_log.participant_id
        AND participants.claimed_by_user_id = auth.uid()
      )
    )
  );
