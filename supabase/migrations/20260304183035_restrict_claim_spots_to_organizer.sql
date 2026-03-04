-- Restrict claim spots to event organizer only
-- Previously any authenticated user could claim spots; now only the event's organizer can

DROP POLICY "Authenticated users can claim spots for others" ON "public"."participants";

CREATE POLICY "Event organizers can claim spots for others"
ON "public"."participants"
FOR INSERT
WITH CHECK (
  claimed_by_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM events
    WHERE events.id = participants.event_id
    AND events.organizer_id = auth.uid()
  )
);

COMMENT ON POLICY "Event organizers can claim spots for others" ON "public"."participants"
IS 'Allows event organizers to create participant records for others (claimed spots) where they are marked as the claimer.';
