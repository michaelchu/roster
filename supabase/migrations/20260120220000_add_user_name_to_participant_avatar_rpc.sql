-- Update get_event_participants_with_avatar to also return full_name
-- This allows displaying the current user name instead of stale denormalized name

DROP FUNCTION IF EXISTS get_event_participants_with_avatar(text);

CREATE OR REPLACE FUNCTION get_event_participants_with_avatar(p_event_id text)
RETURNS TABLE (
  participant_id uuid,
  user_id uuid,
  avatar_url text,
  full_name text
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as participant_id,
    p.user_id,
    COALESCE(
      (u.raw_user_meta_data->>'avatar_url')::text,
      (u.raw_user_meta_data->>'picture')::text
    ) as avatar_url,
    (u.raw_user_meta_data->>'full_name')::text as full_name
  FROM participants p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.event_id = p_event_id;
END;
$$;
