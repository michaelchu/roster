-- Fix: Preserve user-edited display name across Google OAuth re-login
--
-- When users update their name in the Profile page, it's stored in
-- raw_user_meta_data.full_name. But Google OAuth overwrites full_name
-- on every sign-in with the Google profile name.
--
-- Solution: The Profile page now saves to a separate "custom_name" field
-- that OAuth providers don't touch. All name-resolving functions now
-- check custom_name first.

-- Update get_user_display_name to prefer custom_name
CREATE OR REPLACE FUNCTION "public"."get_user_display_name"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    display_name TEXT;
BEGIN
    SELECT COALESCE(
        raw_user_meta_data->>'custom_name',
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'name',
        email
    ) INTO display_name
    FROM auth.users
    WHERE id = user_id;

    RETURN display_name;
END;
$$;

COMMENT ON FUNCTION "public"."get_user_display_name"("user_id" "uuid") IS 'Helper function to get user display name from auth.users metadata. Returns custom_name, full_name, name, or email in that order. custom_name is set by the user in the Profile page and is not overwritten by OAuth providers.';

-- Update get_user_profile to prefer custom_name
CREATE OR REPLACE FUNCTION "public"."get_user_profile"("user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "email" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        COALESCE(
            u.raw_user_meta_data->>'custom_name',
            u.raw_user_meta_data->>'full_name',
            u.raw_user_meta_data->>'name',
            u.email
        ) as name,
        u.email,
        u.created_at
    FROM auth.users u
    WHERE u.id = user_id;
END;
$$;

COMMENT ON FUNCTION "public"."get_user_profile"("user_id" "uuid") IS 'Helper function to get user profile data including display name from auth.users. Prefers custom_name over OAuth-provided full_name.';

-- Update get_group_members_with_user_info to prefer custom_name
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
    COALESCE(
      (u.raw_user_meta_data->>'custom_name')::text,
      (u.raw_user_meta_data->>'full_name')::text
    ) as full_name,
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

-- Update get_event_participants_with_avatar to prefer custom_name
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
    COALESCE(
      (u.raw_user_meta_data->>'custom_name')::text,
      (u.raw_user_meta_data->>'full_name')::text
    ) as full_name
  FROM participants p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.event_id = p_event_id;
END;
$$;
