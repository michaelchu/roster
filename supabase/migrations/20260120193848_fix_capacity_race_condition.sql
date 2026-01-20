-- Fix race condition in capacity enforcement
-- The previous implementation had a TOCTOU (Time-Of-Check to Time-Of-Use) vulnerability
-- where concurrent registrations could both pass the capacity check and exceed max_participants.
--
-- This fix uses SELECT ... FOR UPDATE to acquire a row-level lock on the event,
-- ensuring only one registration can check and insert at a time.

CREATE OR REPLACE FUNCTION "public"."check_event_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    event_record RECORD;
    current_participant_count INTEGER;
BEGIN
    -- Lock the event row to prevent concurrent capacity checks
    -- FOR UPDATE ensures serialized access during concurrent registrations
    SELECT id, max_participants INTO event_record
    FROM events
    WHERE id = NEW.event_id
    FOR UPDATE;

    -- If event doesn't exist, let it fail on FK constraint
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- If no max_participants is set, allow the registration
    IF event_record.max_participants IS NULL THEN
        RETURN NEW;
    END IF;

    -- Count current participants for this event
    -- The FOR UPDATE lock above ensures this count is consistent
    SELECT COUNT(*) INTO current_participant_count
    FROM participants
    WHERE event_id = NEW.event_id;

    -- Check if we're at or over capacity
    IF current_participant_count >= event_record.max_participants THEN
        RAISE EXCEPTION 'Event is at full capacity (% participants)', event_record.max_participants
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."check_event_capacity"()
IS 'Prevents registrations when an event has reached its max_participants limit. Uses row-level locking to prevent race conditions.';
