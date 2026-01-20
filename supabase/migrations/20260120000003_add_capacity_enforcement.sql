-- Add capacity enforcement to prevent over-registration
-- This trigger checks if an event has reached max_participants before allowing new registrations

CREATE OR REPLACE FUNCTION "public"."check_event_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    event_max_participants INTEGER;
    current_participant_count INTEGER;
BEGIN
    -- Get the max_participants for the event
    SELECT max_participants INTO event_max_participants
    FROM events
    WHERE id = NEW.event_id;

    -- If no max_participants is set, allow the registration
    IF event_max_participants IS NULL THEN
        RETURN NEW;
    END IF;

    -- Count current participants for this event
    SELECT COUNT(*) INTO current_participant_count
    FROM participants
    WHERE event_id = NEW.event_id;

    -- Check if we're at or over capacity
    IF current_participant_count >= event_max_participants THEN
        RAISE EXCEPTION 'Event is at full capacity (% participants)', event_max_participants
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."check_event_capacity"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."check_event_capacity"()
IS 'Prevents registrations when an event has reached its max_participants limit';

-- Create trigger that runs BEFORE the slot assignment trigger
-- The trigger order is alphabetical, so we name it to run before assign_participant_slot_trigger
CREATE OR REPLACE TRIGGER "a_check_event_capacity_trigger"
    BEFORE INSERT ON "public"."participants"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."check_event_capacity"();

COMMENT ON TRIGGER "a_check_event_capacity_trigger" ON "public"."participants"
IS 'Enforces max_participants limit on events. Named with "a_" prefix to run before assign_participant_slot_trigger';
