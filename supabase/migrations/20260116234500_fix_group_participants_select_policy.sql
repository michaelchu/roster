-- Fix group_participants RLS policies to allow organizers to SELECT
-- The existing policy only has USING clause which doesn't properly cover SELECT operations

-- Add explicit SELECT policy for organizers and admins
CREATE POLICY "Organizers and admins can view participants in their groups"
  ON public.group_participants
  FOR SELECT
  TO authenticated
  USING (
    -- User is the group organizer
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE groups.id = group_participants.group_id
      AND groups.organizer_id = auth.uid()
    )
    OR
    -- User is a group admin
    EXISTS (
      SELECT 1 FROM public.group_admins
      WHERE group_admins.group_id = group_participants.group_id
      AND group_admins.user_id = auth.uid()
    )
  );
