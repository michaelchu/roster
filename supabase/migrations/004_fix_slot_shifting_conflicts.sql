-- Fix slot shifting to avoid unique constraint violations
-- Use a temporary negative offset approach to prevent conflicts

-- Drop the existing function and recreate with proper conflict-free logic
DROP FUNCTION IF EXISTS get_next_slot_number(TEXT, UUID);

-- Updated function that handles slot shifting without unique constraint violations
CREATE OR REPLACE FUNCTION get_next_slot_number(p_event_id TEXT, p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_slot INTEGER;
    is_organizer BOOLEAN := FALSE;
    lock_key BIGINT;
    max_slot INTEGER;
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

        -- If user is organizer, they always get slot #1
        IF is_organizer THEN
            -- Check if slot #1 is occupied by someone else (not the organizer)
            IF EXISTS (
                SELECT 1 FROM participants
                WHERE event_id = p_event_id
                AND slot_number = 1
                AND (user_id IS NULL OR user_id != p_user_id)
            ) THEN
                -- Get the current max slot to avoid conflicts
                SELECT COALESCE(MAX(slot_number), 0) INTO max_slot
                FROM participants
                WHERE event_id = p_event_id;

                -- First, shift all existing participants to negative numbers to avoid conflicts
                UPDATE participants
                SET slot_number = -(slot_number + max_slot + 100)
                WHERE event_id = p_event_id;

                -- Then shift them back to positive numbers, starting from slot 2
                UPDATE participants
                SET slot_number = -(slot_number + max_slot + 100) + 1
                WHERE event_id = p_event_id AND slot_number < 0;
            END IF;

            RETURN 1;
        END IF;

        -- For non-organizers, find the next available slot number
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