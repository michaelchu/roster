-- Allow authenticated users to join groups themselves
-- This enables the invite link flow where users can click "Join Group"

CREATE POLICY "Users can join groups themselves"
  ON public.group_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow users to see their own group memberships
-- This enables checking if a user is already a member before showing "Join" button

CREATE POLICY "Users can view their own group memberships"
  ON public.group_participants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
