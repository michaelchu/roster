-- Recreate batch functions for adding/removing users from groups
-- These work with the new user_id-only schema (no participant_id)

-- Function to add multiple users to a group
CREATE OR REPLACE FUNCTION public.add_participants_to_group(
  p_group_id text,
  p_participant_ids text[]  -- These are actually user_ids now
)
RETURNS TABLE (
  added_count integer,
  skipped_count integer,
  failed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_added_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_user_id TEXT;
BEGIN
  -- Process each user
  FOREACH v_user_id IN ARRAY p_participant_ids
  LOOP
    BEGIN
      -- Try to insert the user into group_participants
      INSERT INTO group_participants (group_id, user_id)
      VALUES (p_group_id, v_user_id::uuid);

      v_added_count := v_added_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        -- User already in group
        v_skipped_count := v_skipped_count + 1;
      WHEN OTHERS THEN
        -- Other errors (e.g., invalid UUID) - we'll skip
        v_skipped_count := v_skipped_count + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_added_count, v_skipped_count, 0;
END;
$$;

-- Function to remove multiple users from a group
CREATE OR REPLACE FUNCTION public.remove_participants_from_group(
  p_group_id text,
  p_participant_ids text[]  -- These are actually user_ids now
)
RETURNS TABLE (
  removed_count integer,
  failed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_removed_count INTEGER := 0;
  v_user_id TEXT;
  v_rows_affected INTEGER;
BEGIN
  -- Process each user
  FOREACH v_user_id IN ARRAY p_participant_ids
  LOOP
    DELETE FROM group_participants
    WHERE group_id = p_group_id
      AND user_id = v_user_id::uuid;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    v_removed_count := v_removed_count + v_rows_affected;
  END LOOP;

  RETURN QUERY SELECT v_removed_count, 0;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.add_participants_to_group(text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_participants_from_group(text, text[]) TO authenticated;
