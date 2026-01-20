-- Create atomic group deletion function
-- This ensures group deletion and event handling happen in a single transaction
-- preventing orphaned data if one operation fails

CREATE OR REPLACE FUNCTION "public"."delete_group_atomic"(
    p_group_id TEXT,
    p_delete_events BOOLEAN DEFAULT FALSE
) RETURNS VOID
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    AS $$
BEGIN
    -- Verify the caller owns this group
    IF NOT EXISTS (
        SELECT 1 FROM groups
        WHERE id = p_group_id AND organizer_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Group not found or access denied'
            USING ERRCODE = 'P0001';
    END IF;

    IF p_delete_events THEN
        -- Delete all events in the group (cascades to participants, labels, etc.)
        DELETE FROM events WHERE group_id = p_group_id;
    ELSE
        -- Unassociate events from the group
        UPDATE events SET group_id = NULL WHERE group_id = p_group_id;
    END IF;

    -- Delete the group itself
    DELETE FROM groups WHERE id = p_group_id;
END;
$$;

ALTER FUNCTION "public"."delete_group_atomic"(TEXT, BOOLEAN) OWNER TO "postgres";

-- Grant execute to authenticated users (RLS in function handles authorization)
GRANT EXECUTE ON FUNCTION "public"."delete_group_atomic"(TEXT, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION "public"."delete_group_atomic"(TEXT, BOOLEAN)
IS 'Atomically deletes a group and either deletes or unassociates its events. Runs in a single transaction to prevent orphaned data.';
