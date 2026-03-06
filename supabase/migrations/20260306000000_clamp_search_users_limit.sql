-- Clamp result_limit in search_users to prevent unbounded queries.

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
DECLARE
  clamped_limit int;
BEGIN
  -- Only allow platform admins
  IF NOT coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) THEN
    RAISE EXCEPTION 'Forbidden: admin access required';
  END IF;

  -- Clamp limit between 1 and 50
  clamped_limit := GREATEST(1, LEAST(50, coalesce(result_limit, 10)));

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
  LIMIT clamped_limit;
END;
$$;
