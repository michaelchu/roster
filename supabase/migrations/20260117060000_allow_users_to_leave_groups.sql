-- Allow users to leave groups by deleting their own group_participants record

CREATE POLICY "Users can leave groups they belong to"
ON "public"."group_participants"
FOR DELETE
USING (user_id = auth.uid());
