-- Fix infinite recursion in group_participants RLS policies
-- The "Group members can view other members" policy causes recursion
-- because it queries group_participants from within a group_participants policy

-- Drop the recursive policy
DROP POLICY IF EXISTS "Group members can view other members in their groups" ON public.group_participants;

-- Keep only the organizer/admin SELECT policy (non-recursive)
-- This policy already exists from the previous migration, so this is just documentation
-- Organizers and admins can view participants without recursion because it only checks
-- the groups and group_admins tables, not group_participants itself
