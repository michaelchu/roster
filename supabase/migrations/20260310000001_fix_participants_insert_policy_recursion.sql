-- Fix infinite recursion in participants INSERT policy.
-- The "Registered participants can claim spots" policy queries participants
-- within an INSERT policy, which triggers SELECT policies on participants,
-- causing Postgres to detect infinite recursion.
-- Solution: use a SECURITY DEFINER function to bypass RLS for the check.

CREATE OR REPLACE FUNCTION public.is_event_participant(p_event_id TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM participants
    WHERE event_id = p_event_id
    AND user_id = p_user_id
  );
$$;

-- Drop whichever policy name exists (old name on local, new name on remote)
DROP POLICY IF EXISTS "Event organizers can claim spots for others" ON "public"."participants";
DROP POLICY IF EXISTS "Registered participants can claim spots for others" ON "public"."participants";

CREATE POLICY "Registered participants can claim spots for others"
ON "public"."participants"
FOR INSERT
WITH CHECK (
  claimed_by_user_id = auth.uid()
  AND (
    -- Event organizer can always claim
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = participants.event_id
      AND events.organizer_id = auth.uid()
    )
    OR
    -- Any registered participant can claim (uses SECURITY DEFINER to avoid recursion)
    public.is_event_participant(participants.event_id, auth.uid())
  )
);
