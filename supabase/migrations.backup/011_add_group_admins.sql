-- Add group admins functionality
-- This migration creates a group_admins table to track admin roles for groups

-- Create group_admins table to track admin permissions
CREATE TABLE IF NOT EXISTS group_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(group_id, user_id)
);

-- Add constraints for group_admins table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_admins_group_id_fkey') THEN
        ALTER TABLE group_admins ADD CONSTRAINT group_admins_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_admins_user_id_fkey') THEN
        ALTER TABLE group_admins ADD CONSTRAINT group_admins_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES organizers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_admins_group_id_nanoid_format') THEN
        ALTER TABLE group_admins ADD CONSTRAINT group_admins_group_id_nanoid_format
        CHECK (group_id ~ '^[A-Za-z0-9_-]{8,12}$');
    END IF;
END $$;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_group_admins_group_id ON group_admins(group_id);
CREATE INDEX IF NOT EXISTS idx_group_admins_user_id ON group_admins(user_id);

-- Enable Row Level Security
ALTER TABLE group_admins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for group_admins
-- Group owners and admins can view admins
DROP POLICY IF EXISTS "Group owners and admins can view admins" ON group_admins;
CREATE POLICY "Group owners and admins can view admins" ON group_admins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_admins.group_id
            AND (
                groups.organizer_id = auth.uid()  -- Group owner
                OR EXISTS (                        -- Or existing admin
                    SELECT 1 FROM group_admins ga
                    WHERE ga.group_id = groups.id
                    AND ga.user_id = auth.uid()
                )
            )
        )
    );

-- Only group owners can add new admins
DROP POLICY IF EXISTS "Group owners can add admins" ON group_admins;
CREATE POLICY "Group owners can add admins" ON group_admins
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_admins.group_id
            AND groups.organizer_id = auth.uid()
        )
    );

-- Only group owners can remove admins
DROP POLICY IF EXISTS "Group owners can remove admins" ON group_admins;
CREATE POLICY "Group owners can remove admins" ON group_admins
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_admins.group_id
            AND groups.organizer_id = auth.uid()
        )
    );

-- Update group_participants RLS policy to include admins
DROP POLICY IF EXISTS "Organizers can manage participants in their groups" ON group_participants;
CREATE POLICY "Organizers and admins can manage participants in their groups" ON group_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_participants.group_id
            AND (
                groups.organizer_id = auth.uid()  -- Group owner
                OR EXISTS (                        -- Or group admin
                    SELECT 1 FROM group_admins
                    WHERE group_admins.group_id = groups.id
                    AND group_admins.user_id = auth.uid()
                )
            )
        )
    );

-- Add comment explaining the table
COMMENT ON TABLE group_admins IS 'Stores admin roles for groups. Group owners can designate other organizers as admins who can help manage the group.';