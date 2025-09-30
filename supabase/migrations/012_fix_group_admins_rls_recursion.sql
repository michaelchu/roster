-- Fix infinite recursion in group_admins RLS policies
-- The issue is that the SELECT policy checks group_admins table, causing recursion

-- Drop the problematic policies
DROP POLICY IF EXISTS "Group owners and admins can view admins" ON group_admins;
DROP POLICY IF EXISTS "Organizers and admins can manage participants in their groups" ON group_participants;

-- Simplified policy: Only group owners can view admins (no recursion)
CREATE POLICY "Group owners can view admins" ON group_admins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_admins.group_id
            AND groups.organizer_id = auth.uid()
        )
    );

-- Allow users to view their own admin records
CREATE POLICY "Users can view their own admin status" ON group_admins
    FOR SELECT USING (user_id = auth.uid());

-- Update group_participants policy with simplified admin check
CREATE POLICY "Organizers and admins can manage participants in their groups" ON group_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_participants.group_id
            AND groups.organizer_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM group_admins
            WHERE group_admins.group_id = group_participants.group_id
            AND group_admins.user_id = auth.uid()
        )
    );