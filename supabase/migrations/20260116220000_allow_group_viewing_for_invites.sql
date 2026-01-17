-- Allow anyone (including anonymous users) to view groups via invite links
-- This enables the invite link flow where users can see group details before joining/signing in

CREATE POLICY "Anyone can view groups via invite links"
  ON public.groups
  FOR SELECT
  USING (true);

-- Drop the restrictive "view own groups" policy since the new policy covers it
DROP POLICY IF EXISTS "Users can view own groups" ON public.groups;
