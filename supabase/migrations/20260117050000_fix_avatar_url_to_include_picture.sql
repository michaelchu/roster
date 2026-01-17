-- Update functions to use COALESCE for avatar_url and picture
-- Google OAuth stores avatar in 'picture', manual uploads use 'avatar_url'

-- Update get_group_members_with_user_info
DROP FUNCTION IF EXISTS get_group_members_with_user_info(text);

CREATE OR REPLACE FUNCTION get_group_members_with_user_info(p_group_id text)
RETURNS TABLE (
  user_id uuid,
  joined_at timestamptz,
  email text,
  full_name text,
  avatar_url text
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gp.user_id,
    gp.joined_at,
    u.email::text,
    (u.raw_user_meta_data->>'full_name')::text as full_name,
    COALESCE(
      (u.raw_user_meta_data->>'avatar_url')::text,
      (u.raw_user_meta_data->>'picture')::text
    ) as avatar_url
  FROM group_participants gp
  JOIN auth.users u ON u.id = gp.user_id
  WHERE gp.group_id = p_group_id
  ORDER BY gp.joined_at DESC;
END;
$$;

-- Create function to get participant info with avatar for events
CREATE OR REPLACE FUNCTION get_event_participants_with_avatar(p_event_id text)
RETURNS TABLE (
  participant_id uuid,
  user_id uuid,
  avatar_url text
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
    ) as avatar_url
  FROM participants p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.event_id = p_event_id;
END;
$$;
