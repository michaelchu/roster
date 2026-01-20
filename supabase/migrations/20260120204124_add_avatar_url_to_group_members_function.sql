-- Add avatar_url to get_group_members_with_user_info function
-- This was missing and caused a TypeScript error

DROP FUNCTION IF EXISTS "public"."get_group_members_with_user_info"(text);

CREATE OR REPLACE FUNCTION "public"."get_group_members_with_user_info"(p_group_id text)
RETURNS TABLE(user_id uuid, joined_at timestamp with time zone, email text, full_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gp.user_id,
    gp.joined_at,
    u.email::text,
    (u.raw_user_meta_data->>'full_name')::text as full_name,
    (u.raw_user_meta_data->>'avatar_url')::text as avatar_url
  FROM group_participants gp
  JOIN auth.users u ON u.id = gp.user_id
  WHERE gp.group_id = p_group_id
  ORDER BY gp.joined_at DESC;
END;
$$;

ALTER FUNCTION "public"."get_group_members_with_user_info"(text) OWNER TO "postgres";
