-- Restrict which columns can be modified on participants table
-- Organizers should only be able to update participant info fields, not ownership fields
-- This prevents an organizer from reassigning a participant's user_id or claimed_by_user_id

CREATE OR REPLACE FUNCTION "public"."prevent_participant_ownership_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Prevent changing user_id (who registered)
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION 'Cannot modify participant user_id'
            USING ERRCODE = 'P0001';
    END IF;

    -- Prevent changing claimed_by_user_id (who claimed the spot)
    IF OLD.claimed_by_user_id IS DISTINCT FROM NEW.claimed_by_user_id THEN
        RAISE EXCEPTION 'Cannot modify participant claimed_by_user_id'
            USING ERRCODE = 'P0001';
    END IF;

    -- Prevent changing event_id (moving participant between events)
    IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
        RAISE EXCEPTION 'Cannot modify participant event_id'
            USING ERRCODE = 'P0001';
    END IF;

    -- Note: slot_number is NOT restricted here because it's legitimately
    -- modified by the compact_slots_after_deletion trigger function

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."prevent_participant_ownership_change"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."prevent_participant_ownership_change"()
IS 'Prevents modification of ownership and identity columns on participants. Organizers can only update info fields like name, email, phone, notes, responses, and payment fields.';

-- Create the trigger (drop first if exists for idempotency)
DROP TRIGGER IF EXISTS "prevent_participant_ownership_change_trigger" ON "public"."participants";
CREATE TRIGGER "prevent_participant_ownership_change_trigger"
    BEFORE UPDATE ON "public"."participants"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."prevent_participant_ownership_change"();

COMMENT ON TRIGGER "prevent_participant_ownership_change_trigger" ON "public"."participants"
IS 'Enforces that user_id, claimed_by_user_id, and event_id cannot be changed after creation';
