-- Allow users to delete their own participant records (withdraw from events)
-- This policy allows users to withdraw from events they've joined
CREATE POLICY "Users can withdraw from events they joined"
ON "public"."participants"
FOR DELETE
USING (
  -- User can delete if they are the participant (their own registration)
  ("user_id" = "auth"."uid"())
  OR
  -- User can delete spots they claimed for others
  ("claimed_by_user_id" = "auth"."uid"())
);
