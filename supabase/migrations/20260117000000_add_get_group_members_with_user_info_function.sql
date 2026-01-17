-- Create a function to get group members with their user information
-- This allows fetching user emails and metadata without needing admin access
CREATE OR REPLACE FUNCTION get_group_members_with_user_info(p_group_id text)
RETURNS TABLE (
  user_id uuid,
  joined_at timestamptz,
  email text,
  full_name text
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
    (u.raw_user_meta_data->>'full_name')::text as full_name
  FROM group_participants gp
  JOIN auth.users u ON u.id = gp.user_id
  WHERE gp.group_id = p_group_id
  ORDER BY gp.joined_at DESC;
END;
$$;
