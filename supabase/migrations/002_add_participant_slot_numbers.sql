-- Add slot number system for participants
-- This migration adds persistent slot numbers with race condition protection

-- Add slot_number column to participants table
ALTER TABLE participants ADD COLUMN slot_number INTEGER;

-- Create unique index to prevent duplicate slot numbers within an event
CREATE UNIQUE INDEX idx_participants_event_slot ON participants(event_id, slot_number);

-- Create index for efficient slot number queries
CREATE INDEX idx_participants_slot_number ON participants(slot_number);

-- Function to get the next available slot number for an event
-- This function handles race conditions by using advisory locks
CREATE OR REPLACE FUNCTION get_next_slot_number(p_event_id TEXT, p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_slot INTEGER;
    is_organizer BOOLEAN := FALSE;
    lock_key BIGINT;
BEGIN
    -- Create a deterministic lock key based on event_id
    lock_key := ('x' || substr(md5(p_event_id), 1, 15))::bit(60)::bigint;

    -- Acquire advisory lock to prevent race conditions
    PERFORM pg_advisory_lock(lock_key);

    BEGIN
        -- Check if user is the organizer of this event
        IF p_user_id IS NOT NULL THEN
            SELECT TRUE INTO is_organizer
            FROM events
            WHERE id = p_event_id AND organizer_id = p_user_id;
        END IF;

        -- If user is organizer, try to assign slot #1
        IF is_organizer THEN
            -- Check if slot #1 is available
            IF NOT EXISTS (
                SELECT 1 FROM participants
                WHERE event_id = p_event_id AND slot_number = 1
            ) THEN
                RETURN 1;
            END IF;
        END IF;

        -- Find the next available slot number
        SELECT COALESCE(MAX(slot_number), 0) + 1 INTO next_slot
        FROM participants
        WHERE event_id = p_event_id;

        -- Double-check that this slot is actually available (in case of gaps)
        WHILE EXISTS (
            SELECT 1 FROM participants
            WHERE event_id = p_event_id AND slot_number = next_slot
        ) LOOP
            next_slot := next_slot + 1;
        END LOOP;

        RETURN next_slot;
    EXCEPTION
        WHEN OTHERS THEN
            -- Release lock on error and re-raise
            PERFORM pg_advisory_unlock(lock_key);
            RAISE;
    END;

    -- Release the advisory lock
    PERFORM pg_advisory_unlock(lock_key);
END;
$$;

-- Function to assign slot number to a participant
-- This function should be called during participant creation
CREATE OR REPLACE FUNCTION assign_participant_slot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    assigned_slot INTEGER;
BEGIN
    -- Only assign slot if it's not already set
    IF NEW.slot_number IS NULL THEN
        -- Get the next available slot number
        assigned_slot := get_next_slot_number(NEW.event_id, NEW.user_id);
        NEW.slot_number := assigned_slot;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger to automatically assign slot numbers
CREATE TRIGGER assign_participant_slot_trigger
    BEFORE INSERT ON participants
    FOR EACH ROW
    EXECUTE FUNCTION assign_participant_slot();

-- Backfill existing participants with slot numbers
-- Organizers get slot #1 in their events, others get sequential slots
DO $$
DECLARE
    event_record RECORD;
    participant_record RECORD;
    current_slot INTEGER;
BEGIN
    -- Process each event
    FOR event_record IN
        SELECT DISTINCT event_id FROM participants WHERE slot_number IS NULL
    LOOP
        current_slot := 1;

        -- First, assign slot #1 to organizer if they're a participant
        UPDATE participants SET slot_number = 1
        WHERE event_id = event_record.event_id
          AND slot_number IS NULL
          AND user_id = (SELECT organizer_id FROM events WHERE id = event_record.event_id)
          AND EXISTS (SELECT 1 FROM events WHERE id = event_record.event_id AND organizer_id = participants.user_id);

        -- If organizer was assigned slot #1, start from slot #2 for others
        IF FOUND THEN
            current_slot := 2;
        END IF;

        -- Assign remaining slots based on created_at order
        FOR participant_record IN
            SELECT id FROM participants
            WHERE event_id = event_record.event_id AND slot_number IS NULL
            ORDER BY created_at ASC
        LOOP
            UPDATE participants
            SET slot_number = current_slot
            WHERE id = participant_record.id;

            current_slot := current_slot + 1;
        END LOOP;
    END LOOP;
END;
$$;

-- Update the participants table constraint to ensure slot_number is not null for new records
ALTER TABLE participants ALTER COLUMN slot_number SET NOT NULL;