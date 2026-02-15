-- Add a permissive INSERT policy for authenticated users on participant_activity_log.
--
-- The SECURITY DEFINER RPC function (log_participant_activity) should bypass RLS,
-- but in some Supabase environments the function owner's role does not bypass RLS
-- as expected, causing error 42501 when participants sign up or withdraw.
--
-- This policy allows any authenticated user to insert activity log entries.
-- This is safe because:
--   1. The table is append-only (no UPDATE/DELETE policies exist)
--   2. Database constraints validate activity_type (CHECK) and foreign keys
--   3. The SELECT policy still restricts reads to event organizers only

CREATE POLICY "Authenticated users can insert activity logs"
  ON participant_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);
