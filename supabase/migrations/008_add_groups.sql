-- Add groups functionality with direct group-participant relationships
-- This migration creates groups table, group-participants junction table, and updates events table

-- Create groups table with nanoid primary key (consistent with events)
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY DEFAULT nanoid(10),
    organizer_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 200),
    description TEXT CHECK (length(description) <= 2000),
    is_private BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add constraints for groups table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_organizer_id_fkey') THEN
        ALTER TABLE groups ADD CONSTRAINT groups_organizer_id_fkey
        FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'groups_id_nanoid_format') THEN
        ALTER TABLE groups ADD CONSTRAINT groups_id_nanoid_format
        CHECK (id ~ '^[A-Za-z0-9_-]{8,12}$');
    END IF;
END $$;

-- Create group_participants junction table for direct group membership
CREATE TABLE IF NOT EXISTS group_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT NOT NULL,
    participant_id UUID NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add constraints for group_participants table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_participants_group_id_fkey') THEN
        ALTER TABLE group_participants ADD CONSTRAINT group_participants_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_participants_participant_id_fkey') THEN
        ALTER TABLE group_participants ADD CONSTRAINT group_participants_participant_id_fkey
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_participants_group_id_participant_id_key') THEN
        ALTER TABLE group_participants ADD CONSTRAINT group_participants_group_id_participant_id_key
        UNIQUE(group_id, participant_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_participants_group_id_nanoid_format') THEN
        ALTER TABLE group_participants ADD CONSTRAINT group_participants_group_id_nanoid_format
        CHECK (group_id ~ '^[A-Za-z0-9_-]{8,12}$');
    END IF;
END $$;

-- Add group_id column to events table (nullable for backward compatibility)
ALTER TABLE events ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Add constraints for events.group_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_group_id_fkey') THEN
        ALTER TABLE events ADD CONSTRAINT events_group_id_fkey
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_group_id_nanoid_format') THEN
        ALTER TABLE events ADD CONSTRAINT events_group_id_nanoid_format
        CHECK (group_id IS NULL OR group_id ~ '^[A-Za-z0-9_-]{8,12}$');
    END IF;
END $$;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_groups_organizer_id ON groups(organizer_id);
CREATE INDEX IF NOT EXISTS idx_groups_created_at ON groups(created_at);
CREATE INDEX IF NOT EXISTS idx_groups_is_private ON groups(is_private);

CREATE INDEX IF NOT EXISTS idx_group_participants_group_id ON group_participants(group_id);
CREATE INDEX IF NOT EXISTS idx_group_participants_participant_id ON group_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_group_participants_joined_at ON group_participants(joined_at);

CREATE INDEX IF NOT EXISTS idx_events_group_id ON events(group_id);

-- Enable Row Level Security for new tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_participants ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for groups (organizers can only manage their own groups)
DROP POLICY IF EXISTS "Users can view own groups" ON groups;
CREATE POLICY "Users can view own groups" ON groups
    FOR SELECT USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own groups" ON groups;
CREATE POLICY "Users can create own groups" ON groups
    FOR INSERT WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own groups" ON groups;
CREATE POLICY "Users can update own groups" ON groups
    FOR UPDATE USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own groups" ON groups;
CREATE POLICY "Users can delete own groups" ON groups
    FOR DELETE USING (organizer_id = auth.uid());

-- Create RLS policies for group_participants
-- Organizers can manage participants in their groups
DROP POLICY IF EXISTS "Organizers can manage participants in their groups" ON group_participants;
CREATE POLICY "Organizers can manage participants in their groups" ON group_participants
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM groups
            WHERE groups.id = group_participants.group_id
            AND groups.organizer_id = auth.uid()
        )
    );

-- Function to automatically add participants to groups when they join group events
CREATE OR REPLACE FUNCTION auto_add_participant_to_group()
RETURNS trigger AS $$
DECLARE
    event_group_id TEXT;
BEGIN
    -- Get the group_id for the event the participant just joined
    SELECT group_id INTO event_group_id
    FROM events
    WHERE id = NEW.event_id;

    -- If the event belongs to a group, add the participant to that group
    IF event_group_id IS NOT NULL THEN
        INSERT INTO group_participants (group_id, participant_id, joined_at)
        VALUES (event_group_id, NEW.id, NEW.created_at)
        ON CONFLICT (group_id, participant_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically add participants to groups
DROP TRIGGER IF EXISTS auto_add_participant_to_group_trigger ON participants;
CREATE TRIGGER auto_add_participant_to_group_trigger
    AFTER INSERT ON participants
    FOR EACH ROW
    EXECUTE FUNCTION auto_add_participant_to_group();

-- Function to remove participants from groups when they're removed from all group events
CREATE OR REPLACE FUNCTION auto_remove_participant_from_group()
RETURNS trigger AS $$
DECLARE
    event_group_id TEXT;
    remaining_events_count INTEGER;
BEGIN
    -- Get the group_id for the event the participant was removed from
    SELECT group_id INTO event_group_id
    FROM events
    WHERE id = OLD.event_id;

    -- If the event belonged to a group, check if participant has other events in same group
    IF event_group_id IS NOT NULL THEN
        SELECT COUNT(*) INTO remaining_events_count
        FROM participants p
        JOIN events e ON p.event_id = e.id
        WHERE (
            -- Match by user_id if the participant was a registered user
            (OLD.user_id IS NOT NULL AND p.user_id = OLD.user_id)
            OR
            -- Match by email if the participant was a guest or for additional safety
            (OLD.email IS NOT NULL AND p.email = OLD.email)
        )
        AND e.group_id = event_group_id;

        -- If no more events in this group, remove from group
        IF remaining_events_count = 0 THEN
            DELETE FROM group_participants gp
            WHERE gp.group_id = event_group_id
            AND EXISTS (
                SELECT 1 FROM participants p
                WHERE p.id = gp.participant_id
                AND (
                    -- Match by user_id if the participant was a registered user
                    (OLD.user_id IS NOT NULL AND p.user_id = OLD.user_id)
                    OR
                    -- Match by email if the participant was a guest or for additional safety
                    (OLD.email IS NOT NULL AND p.email = OLD.email)
                )
            );
        END IF;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically remove participants from groups when appropriate
DROP TRIGGER IF EXISTS auto_remove_participant_from_group_trigger ON participants;
CREATE TRIGGER auto_remove_participant_from_group_trigger
    AFTER DELETE ON participants
    FOR EACH ROW
    EXECUTE FUNCTION auto_remove_participant_from_group();

-- Add comment explaining the new architecture
COMMENT ON TABLE groups IS 'Groups organize events and manage participant membership. Events can optionally belong to groups.';
COMMENT ON TABLE group_participants IS 'Direct many-to-many relationship between groups and participants. Participants automatically join groups when registering for group events.';
COMMENT ON COLUMN events.group_id IS 'Optional reference to the group this event belongs to. NULL means standalone event.';