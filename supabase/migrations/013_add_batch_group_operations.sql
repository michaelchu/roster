-- Add atomic batch operations for group membership management
-- This migration creates RPC functions for batch add/remove operations with ACID guarantees

-- Function to atomically add multiple participants to a group
-- Returns counts of successful additions, skipped duplicates, and errors
CREATE OR REPLACE FUNCTION add_participants_to_group(
    p_group_id TEXT,
    p_participant_ids TEXT[]
)
RETURNS TABLE(
    added_count INTEGER,
    skipped_count INTEGER,
    failed_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_added_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_participant_id TEXT;
    v_user_id UUID;
    v_email TEXT;
BEGIN
    -- Verify user has permission (is owner or admin of the group)
    IF NOT EXISTS (
        SELECT 1 FROM groups
        WHERE id = p_group_id
        AND (
            organizer_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM group_admins
                WHERE group_id = p_group_id
                AND user_id = auth.uid()
            )
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User is not an admin of this group';
    END IF;

    -- Process each participant in a single transaction
    FOREACH v_participant_id IN ARRAY p_participant_ids
    LOOP
        BEGIN
            -- Get participant's stable identifiers
            SELECT user_id, email INTO v_user_id, v_email
            FROM participants
            WHERE id = v_participant_id;

            IF NOT FOUND THEN
                v_failed_count := v_failed_count + 1;
                CONTINUE;
            END IF;

            -- Try to insert the participant into group_participants
            INSERT INTO group_participants (group_id, participant_id, user_id, guest_email)
            VALUES (
                p_group_id,
                v_participant_id,
                v_user_id,
                CASE WHEN v_user_id IS NULL THEN v_email ELSE NULL END
            );

            v_added_count := v_added_count + 1;

        EXCEPTION
            WHEN unique_violation THEN
                -- Participant already in group, skip silently
                v_skipped_count := v_skipped_count + 1;
            WHEN OTHERS THEN
                -- Other errors
                v_failed_count := v_failed_count + 1;
        END;
    END LOOP;

    RETURN QUERY SELECT v_added_count, v_skipped_count, v_failed_count;
END;
$$;

-- Function to atomically remove multiple participants from a group
-- Returns counts of successful removals and failures
CREATE OR REPLACE FUNCTION remove_participants_from_group(
    p_group_id TEXT,
    p_participant_ids TEXT[]
)
RETURNS TABLE(
    removed_count INTEGER,
    failed_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_removed_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_participant_id TEXT;
    v_user_id UUID;
    v_email TEXT;
    v_rows_deleted INTEGER;
BEGIN
    -- Verify user has permission (is owner or admin of the group)
    IF NOT EXISTS (
        SELECT 1 FROM groups
        WHERE id = p_group_id
        AND (
            organizer_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM group_admins
                WHERE group_id = p_group_id
                AND user_id = auth.uid()
            )
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: User is not an admin of this group';
    END IF;

    -- Process each participant in a single transaction
    FOREACH v_participant_id IN ARRAY p_participant_ids
    LOOP
        BEGIN
            -- Get participant's stable identifiers
            SELECT user_id, email INTO v_user_id, v_email
            FROM participants
            WHERE id = v_participant_id;

            IF NOT FOUND THEN
                v_failed_count := v_failed_count + 1;
                CONTINUE;
            END IF;

            -- Delete using stable identifiers
            IF v_user_id IS NOT NULL THEN
                DELETE FROM group_participants
                WHERE group_id = p_group_id
                AND user_id = v_user_id;
            ELSIF v_email IS NOT NULL THEN
                DELETE FROM group_participants
                WHERE group_id = p_group_id
                AND guest_email = v_email;
            ELSE
                v_failed_count := v_failed_count + 1;
                CONTINUE;
            END IF;

            GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

            IF v_rows_deleted > 0 THEN
                v_removed_count := v_removed_count + 1;
            ELSE
                -- Participant was not in the group
                v_failed_count := v_failed_count + 1;
            END IF;

        EXCEPTION
            WHEN OTHERS THEN
                v_failed_count := v_failed_count + 1;
        END;
    END LOOP;

    RETURN QUERY SELECT v_removed_count, v_failed_count;
END;
$$;

-- Grant execute permissions to authenticated users (RLS policies will handle authorization)
GRANT EXECUTE ON FUNCTION add_participants_to_group(TEXT, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_participants_from_group(TEXT, TEXT[]) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION add_participants_to_group IS 'Atomically add multiple participants to a group. Only group owners and admins can execute. Returns counts of added, skipped (duplicates), and failed operations.';
COMMENT ON FUNCTION remove_participants_from_group IS 'Atomically remove multiple participants from a group. Only group owners and admins can execute. Returns counts of removed and failed operations.';