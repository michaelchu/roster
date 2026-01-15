-- Optimize get_next_slot_number to prevent timeouts
-- Simplify logic and reduce UPDATE operations

CREATE OR REPLACE FUNCTION "public"."get_next_slot_number"("p_event_id" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_slot INTEGER;
    is_organizer BOOLEAN := FALSE;
BEGIN
    -- Check if user is the organizer of this event
    IF p_user_id IS NOT NULL THEN
        SELECT (organizer_id = p_user_id) INTO is_organizer
        FROM events
        WHERE id = p_event_id;
    END IF;

    -- If user is organizer and slot #1 is available, take it
    IF is_organizer THEN
        -- Check if slot #1 is free
        IF NOT EXISTS (
            SELECT 1 FROM participants
            WHERE event_id = p_event_id
            AND slot_number = 1
        ) THEN
            RETURN 1;
        END IF;
        
        -- Slot #1 is taken, organizer gets next available slot like anyone else
        -- (Don't do expensive slot shifting during insert)
    END IF;

    -- For everyone else (or organizer if slot 1 is taken), get next available slot
    SELECT COALESCE(MAX(slot_number), 0) + 1 INTO next_slot
    FROM participants
    WHERE event_id = p_event_id;

    RETURN next_slot;
END;
$$;

COMMENT ON FUNCTION "public"."get_next_slot_number"("p_event_id" "text", "p_user_id" "uuid") 
IS 'Simplified slot assignment: organizer gets slot 1 if available, otherwise everyone gets next sequential slot. No expensive updates during insert.';
