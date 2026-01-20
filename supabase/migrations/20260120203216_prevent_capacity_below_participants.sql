-- Prevent reducing max_participants below current participant count
-- Organizers must remove participants first before reducing capacity

CREATE OR REPLACE FUNCTION "public"."check_capacity_reduction"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    current_participant_count INTEGER;
BEGIN
    -- Only check when max_participants is being reduced (not removed or increased)
    IF NEW.max_participants IS NULL THEN
        RETURN NEW;
    END IF;

    -- If old value was NULL or new value is >= old value, allow
    IF OLD.max_participants IS NULL OR NEW.max_participants >= OLD.max_participants THEN
        RETURN NEW;
    END IF;

    -- Count current participants
    SELECT COUNT(*) INTO current_participant_count
    FROM participants
    WHERE event_id = NEW.id;

    -- Block if reducing below current count
    IF NEW.max_participants < current_participant_count THEN
        RAISE EXCEPTION 'Cannot reduce capacity to % when % participants are registered. Remove participants first.',
            NEW.max_participants, current_participant_count
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."check_capacity_reduction"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."check_capacity_reduction"()
IS 'Prevents organizers from reducing max_participants below current participant count';

-- Create the trigger
DROP TRIGGER IF EXISTS "check_capacity_reduction_trigger" ON "public"."events";
CREATE TRIGGER "check_capacity_reduction_trigger"
    BEFORE UPDATE ON "public"."events"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."check_capacity_reduction"();

COMMENT ON TRIGGER "check_capacity_reduction_trigger" ON "public"."events"
IS 'Enforces that max_participants cannot be reduced below current participant count';
