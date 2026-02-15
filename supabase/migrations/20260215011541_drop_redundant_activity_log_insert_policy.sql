-- Drop the redundant INSERT policy on participant_activity_log.
-- All inserts now go through the log_participant_activity() RPC function
-- which uses SECURITY DEFINER to bypass RLS, making this policy dead code.
DROP POLICY "Organizers can insert activity for their events" ON participant_activity_log;
