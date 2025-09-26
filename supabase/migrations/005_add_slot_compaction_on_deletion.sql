-- Add slot compaction when participants are deleted
-- When a participant is removed, shift all higher-numbered participants up to fill the gap

-- Function to compact slots after a participant is deleted
CREATE OR REPLACE FUNCTION compact_slots_after_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_slot INTEGER;
    lock_key BIGINT;
BEGIN
    -- Get the slot number of the deleted participant
    deleted_slot := OLD.slot_number;

    -- Only compact if the deleted participant had a slot number
    IF deleted_slot IS NOT NULL THEN
        -- Create a deterministic lock key based on event_id
        lock_key := ('x' || substr(md5(OLD.event_id), 1, 15))::bit(60)::bigint;

        -- Acquire advisory lock to prevent race conditions
        PERFORM pg_advisory_lock(lock_key);

        BEGIN
            -- Shift all participants with higher slot numbers down by 1
            UPDATE participants
            SET slot_number = slot_number - 1
            WHERE event_id = OLD.event_id
            AND slot_number > deleted_slot;

        EXCEPTION
            WHEN OTHERS THEN
                -- Release lock on error and re-raise
                PERFORM pg_advisory_unlock(lock_key);
                RAISE;
        END;

        -- Release the advisory lock
        PERFORM pg_advisory_unlock(lock_key);
    END IF;

    RETURN OLD;
END;
$$;

-- Create trigger to automatically compact slots after participant deletion
DROP TRIGGER IF EXISTS compact_slots_after_participant_deletion ON participants;
CREATE TRIGGER compact_slots_after_participant_deletion
    AFTER DELETE ON participants
    FOR EACH ROW
    EXECUTE FUNCTION compact_slots_after_deletion();