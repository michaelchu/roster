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
-- Uses stable identifiers (user_id for auth users, guest_email for guests) to avoid duplicates
CREATE TABLE IF NOT EXISTS group_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id TEXT NOT NULL,
    participant_id UUID NOT NULL, -- Keep for traceability to the original registration
    user_id UUID, -- For authenticated users (stable across multiple event registrations)
    guest_email TEXT, -- For guest users (stable identifier for non-authenticated participants)
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

    -- Remove the old unique constraint on participant_id as it causes duplicates
    -- Replace with partial unique constraints on stable identifiers
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_participants_group_id_user_id_key') THEN
        ALTER TABLE group_participants ADD CONSTRAINT group_participants_group_id_user_id_key
        UNIQUE(group_id, user_id) DEFERRABLE INITIALLY DEFERRED;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_participants_group_id_guest_email_key') THEN
        ALTER TABLE group_participants ADD CONSTRAINT group_participants_group_id_guest_email_key
        UNIQUE(group_id, guest_email) DEFERRABLE INITIALLY DEFERRED;
    END IF;

    -- Ensure exactly one of user_id or guest_email is set
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'group_participants_identity_check') THEN
        ALTER TABLE group_participants ADD CONSTRAINT group_participants_identity_check
        CHECK ((user_id IS NOT NULL AND guest_email IS NULL) OR (user_id IS NULL AND guest_email IS NOT NULL));
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
CREATE INDEX IF NOT EXISTS idx_group_participants_user_id ON group_participants(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_participants_guest_email ON group_participants(guest_email) WHERE guest_email IS NOT NULL;
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
-- Uses stable identifiers to prevent duplicate memberships for the same person
CREATE OR REPLACE FUNCTION auto_add_participant_to_group()
RETURNS trigger AS $$
DECLARE
    event_group_id TEXT;
BEGIN
    -- Get the group_id for the event the participant just joined
    SELECT group_id INTO event_group_id
    FROM events
    WHERE id = NEW.event_id;

    -- If the event belongs to a group, add the participant to that group using stable identifiers
    IF event_group_id IS NOT NULL THEN
        -- Insert or update using stable identifiers (user_id for auth users, email for guests)
        IF NEW.user_id IS NOT NULL THEN
            -- Authenticated user: upsert on group_id + user_id
            INSERT INTO group_participants (group_id, participant_id, user_id, joined_at)
            VALUES (event_group_id, NEW.id, NEW.user_id, NEW.created_at)
            ON CONFLICT (group_id, user_id) DO UPDATE SET
                participant_id = NEW.id, -- Update to latest registration for traceability
                joined_at = LEAST(group_participants.joined_at, NEW.created_at); -- Keep earliest join date
        ELSE
            -- Guest user: upsert on group_id + guest_email
            INSERT INTO group_participants (group_id, participant_id, guest_email, joined_at)
            VALUES (event_group_id, NEW.id, NEW.email, NEW.created_at)
            ON CONFLICT (group_id, guest_email) DO UPDATE SET
                participant_id = NEW.id, -- Update to latest registration for traceability
                joined_at = LEAST(group_participants.joined_at, NEW.created_at); -- Keep earliest join date
        END IF;
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

        -- If no more events in this group, remove from group using stable identifiers
        IF remaining_events_count = 0 THEN
            IF OLD.user_id IS NOT NULL THEN
                -- Remove by user_id for authenticated users
                DELETE FROM group_participants
                WHERE group_id = event_group_id AND user_id = OLD.user_id;
            ELSE
                -- Remove by guest_email for guest users
                DELETE FROM group_participants
                WHERE group_id = event_group_id AND guest_email = OLD.email;
            END IF;
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