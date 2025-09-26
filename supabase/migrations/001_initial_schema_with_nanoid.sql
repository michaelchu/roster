-- Initial schema with nanoid support for event IDs
-- This migration creates the complete database schema from scratch
-- Events use nanoid IDs for clean, short URLs
-- This migration is idempotent and safe to run multiple times

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create nanoid function for generating URL-safe unique IDs
CREATE OR REPLACE FUNCTION nanoid(size int DEFAULT 10)
RETURNS text
LANGUAGE plpgsql
VOLATILE
PARALLEL SAFE
AS $$
DECLARE
    alphabet text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-';
    result text := '';
    i int;
    random_byte int;
BEGIN
    IF size IS NULL OR size < 1 THEN
        RAISE EXCEPTION 'The size must be defined and greater than 0!';
    END IF;

    FOR i IN 1..size LOOP
        random_byte := floor(random() * length(alphabet) + 1)::int;
        result := result || substr(alphabet, random_byte, 1);
    END LOOP;

    RETURN result;
END
$$;

-- Create organizers table (uses UUID for Supabase auth integration)
CREATE TABLE IF NOT EXISTS organizers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create events table with nanoid primary key
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY DEFAULT nanoid(10),
    organizer_id UUID NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 200),
    description TEXT CHECK (length(description) <= 2000),
    datetime TIMESTAMPTZ,
    location TEXT CHECK (length(location) <= 500),
    is_private BOOLEAN DEFAULT false NOT NULL,
    custom_fields JSONB DEFAULT '[]'::jsonb NOT NULL,
    parent_event_id TEXT,
    max_participants INTEGER CHECK (max_participants > 0 AND max_participants <= 10000),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_organizer_id_fkey') THEN
        ALTER TABLE events ADD CONSTRAINT events_organizer_id_fkey
        FOREIGN KEY (organizer_id) REFERENCES organizers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_parent_event_id_fkey') THEN
        ALTER TABLE events ADD CONSTRAINT events_parent_event_id_fkey
        FOREIGN KEY (parent_event_id) REFERENCES events(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add check constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_id_nanoid_format') THEN
        ALTER TABLE events ADD CONSTRAINT events_id_nanoid_format
        CHECK (id ~ '^[A-Za-z0-9_-]{8,12}$');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_parent_event_id_nanoid_format') THEN
        ALTER TABLE events ADD CONSTRAINT events_parent_event_id_nanoid_format
        CHECK (parent_event_id IS NULL OR parent_event_id ~ '^[A-Za-z0-9_-]{8,12}$');
    END IF;
END $$;

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 100),
    email TEXT CHECK (email IS NULL OR (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 254)),
    phone TEXT CHECK (phone IS NULL OR (phone ~ '^[+]?[0-9\s\-()]{0,20}$' AND length(phone) <= 20)),
    notes TEXT CHECK (length(notes) <= 1000),
    user_id UUID,
    responses JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add constraints for participants
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_event_id_fkey') THEN
        ALTER TABLE participants ADD CONSTRAINT participants_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_event_id_nanoid_format') THEN
        ALTER TABLE participants ADD CONSTRAINT participants_event_id_nanoid_format
        CHECK (event_id ~ '^[A-Za-z0-9_-]{8,12}$');
    END IF;
END $$;

-- Create labels table for participant categorization
CREATE TABLE IF NOT EXISTS labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 50),
    color TEXT DEFAULT '#gray' CHECK (color ~ '^#[0-9a-fA-F]{6}$|^[a-z]+$')
);

-- Add constraints for labels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'labels_event_id_fkey') THEN
        ALTER TABLE labels ADD CONSTRAINT labels_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'labels_event_id_nanoid_format') THEN
        ALTER TABLE labels ADD CONSTRAINT labels_event_id_nanoid_format
        CHECK (event_id ~ '^[A-Za-z0-9_-]{8,12}$');
    END IF;
END $$;

-- Create participant_labels junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS participant_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL,
    label_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add constraints for participant_labels
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participant_labels_participant_id_fkey') THEN
        ALTER TABLE participant_labels ADD CONSTRAINT participant_labels_participant_id_fkey
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participant_labels_label_id_fkey') THEN
        ALTER TABLE participant_labels ADD CONSTRAINT participant_labels_label_id_fkey
        FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participant_labels_participant_id_label_id_key') THEN
        ALTER TABLE participant_labels ADD CONSTRAINT participant_labels_participant_id_label_id_key
        UNIQUE(participant_id, label_id);
    END IF;
END $$;

-- Create performance indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_datetime ON events(datetime);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_is_private ON events(is_private);

CREATE INDEX IF NOT EXISTS idx_participants_event_id ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_created_at ON participants(created_at);

CREATE INDEX IF NOT EXISTS idx_labels_event_id ON labels(event_id);

CREATE INDEX IF NOT EXISTS idx_participant_labels_participant_id ON participant_labels(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_labels_label_id ON participant_labels(label_id);

-- Enable Row Level Security (RLS) - these are idempotent
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_labels ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organizers (idempotent)
DROP POLICY IF EXISTS "Users can view own organizer record" ON organizers;
CREATE POLICY "Users can view own organizer record" ON organizers
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own organizer record" ON organizers;
CREATE POLICY "Users can update own organizer record" ON organizers
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own organizer record" ON organizers;
CREATE POLICY "Users can insert own organizer record" ON organizers
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Create RLS policies for events (idempotent)
DROP POLICY IF EXISTS "Organizers can view own events" ON events;
CREATE POLICY "Organizers can view own events" ON events
    FOR SELECT USING (
        organizer_id = auth.uid() OR
        (is_private = false)
    );

DROP POLICY IF EXISTS "Organizers can create events" ON events;
CREATE POLICY "Organizers can create events" ON events
    FOR INSERT WITH CHECK (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Organizers can update own events" ON events;
CREATE POLICY "Organizers can update own events" ON events
    FOR UPDATE USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Organizers can delete own events" ON events;
CREATE POLICY "Organizers can delete own events" ON events
    FOR DELETE USING (organizer_id = auth.uid());

-- Create RLS policies for participants (idempotent)
DROP POLICY IF EXISTS "Anyone can view participants of public events" ON participants;
CREATE POLICY "Anyone can view participants of public events" ON participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = participants.event_id
            AND (events.organizer_id = auth.uid() OR events.is_private = false)
        )
    );

DROP POLICY IF EXISTS "Anyone can register for public events" ON participants;
CREATE POLICY "Anyone can register for public events" ON participants
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = participants.event_id
            AND events.is_private = false
        )
    );

DROP POLICY IF EXISTS "Organizers can update participants in their events" ON participants;
CREATE POLICY "Organizers can update participants in their events" ON participants
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = participants.event_id
            AND events.organizer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Organizers can delete participants from their events" ON participants;
CREATE POLICY "Organizers can delete participants from their events" ON participants
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = participants.event_id
            AND events.organizer_id = auth.uid()
        )
    );

-- Create RLS policies for labels (idempotent)
DROP POLICY IF EXISTS "Organizers can manage labels for their events" ON labels;
CREATE POLICY "Organizers can manage labels for their events" ON labels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM events
            WHERE events.id = labels.event_id
            AND events.organizer_id = auth.uid()
        )
    );

-- Create RLS policies for participant labels (idempotent)
DROP POLICY IF EXISTS "Organizers can manage participant labels for their events" ON participant_labels;
CREATE POLICY "Organizers can manage participant labels for their events" ON participant_labels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM participants p
            JOIN events e ON e.id = p.event_id
            WHERE p.id = participant_labels.participant_id
            AND e.organizer_id = auth.uid()
        )
    );

-- Create function to automatically create organizer records when users sign up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO organizers (id, name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'name')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic organizer creation (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();