-- Fix the assign_participant_slot trigger to use claimed_by_user_id when user_id is null
-- This ensures slot numbers are assigned correctly for claimed spots

CREATE OR REPLACE FUNCTION "public"."assign_participant_slot"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    assigned_slot INTEGER;
    effective_user_id UUID;
BEGIN
    -- Only assign slot if it's not already set
    IF NEW.slot_number IS NULL THEN
        -- For claimed spots (user_id is null), use claimed_by_user_id
        -- For self-registrations, use user_id
        effective_user_id := COALESCE(NEW.user_id, NEW.claimed_by_user_id);
        
        -- Get the next available slot number
        assigned_slot := get_next_slot_number(NEW.event_id, effective_user_id);
        NEW.slot_number := assigned_slot;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION "public"."assign_participant_slot"() 
IS 'Trigger function to automatically assign slot numbers to participants. Uses claimed_by_user_id when user_id is null (for claimed spots).';
