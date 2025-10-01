-- Remove redundant organizers table and use auth.users directly
-- The organizers table only stored name/created_at which is redundant with auth.users.raw_user_meta_data

-- 1. Drop the trigger that creates organizer records
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Drop the trigger function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Update events table to reference auth.users directly
-- The foreign key already points to auth.users via UUID, so we just need to update the constraint name for clarity
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;
ALTER TABLE public.events ADD CONSTRAINT events_organizer_id_fkey
    FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Update groups table to reference auth.users directly
ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_organizer_id_fkey;
ALTER TABLE public.groups ADD CONSTRAINT groups_organizer_id_fkey
    FOREIGN KEY (organizer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. Update group_admins table to reference auth.users directly
ALTER TABLE public.group_admins DROP CONSTRAINT IF EXISTS group_admins_user_id_fkey;
ALTER TABLE public.group_admins ADD CONSTRAINT group_admins_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. Drop RLS policies on organizers table
DROP POLICY IF EXISTS "Users can view own organizer record" ON public.organizers;
DROP POLICY IF EXISTS "Users can update own organizer record" ON public.organizers;
DROP POLICY IF EXISTS "Users can insert own organizer record" ON public.organizers;

-- 7. Drop the organizers table
DROP TABLE IF EXISTS public.organizers;

-- 8. Create a helper function to get user display name from auth.users
-- This makes it easier to query user names from the frontend
CREATE OR REPLACE FUNCTION public.get_user_display_name(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    display_name TEXT;
BEGIN
    SELECT COALESCE(
        raw_user_meta_data->>'full_name',
        raw_user_meta_data->>'name',
        email
    ) INTO display_name
    FROM auth.users
    WHERE id = user_id;

    RETURN display_name;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO anon;

COMMENT ON FUNCTION public.get_user_display_name IS 'Helper function to get user display name from auth.users metadata. Returns full_name, name, or email in that order.';

-- 9. Create a helper function to get user profile data
-- Returns id, display_name, email, and created_at for a user
CREATE OR REPLACE FUNCTION public.get_user_profile(user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        COALESCE(
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_user_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile(UUID) TO anon;

COMMENT ON FUNCTION public.get_user_profile IS 'Helper function to get user profile data including display name from auth.users.';
