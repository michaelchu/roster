-- Allow group members to view other members in their groups
-- This enables the group participants page to show all members to anyone in the group

CREATE POLICY "Group members can view other members in their groups"
  ON public.group_participants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.group_participants AS my_membership
      WHERE my_membership.group_id = group_participants.group_id
      AND my_membership.user_id = auth.uid()
    )
  );
