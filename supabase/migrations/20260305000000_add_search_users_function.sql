-- RPC function to search users by email or name.
-- Only callable by platform admins (app_metadata.is_admin = true).
-- Uses SECURITY DEFINER to access auth.users from the client.

CREATE OR REPLACE FUNCTION public.search_users(query text, result_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow platform admins
  IF NOT coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::text,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')::text AS full_name,
    coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture', '')::text AS avatar_url
  FROM auth.users u
  WHERE
    u.email ILIKE '%' || query || '%'
    OR u.raw_user_meta_data ->> 'full_name' ILIKE '%' || query || '%'
    OR u.raw_user_meta_data ->> 'name' ILIKE '%' || query || '%'
  ORDER BY u.created_at DESC
  LIMIT result_limit;
END;
$$;

COMMENT ON FUNCTION public.search_users(text, int) IS 'Search auth.users by email or name. Restricted to platform admins.';

-- Grant execute to authenticated users (the function itself checks admin status)
GRANT EXECUTE ON FUNCTION public.search_users(text, int) TO authenticated;
