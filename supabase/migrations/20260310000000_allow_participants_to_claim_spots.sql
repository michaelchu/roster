-- Allow any registered participant (not just organizers) to claim spots for guests
DROP POLICY "Event organizers can claim spots for others" ON "public"."participants";

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
    -- Any registered participant can claim
    EXISTS (
      SELECT 1 FROM participants AS p
      WHERE p.event_id = participants.event_id
      AND p.user_id = auth.uid()
    )
  )
);
