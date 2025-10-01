-- Fix script for the organizers trigger
-- This ensures the trigger function has the right permissions and is properly configured
-- Run this in your Supabase SQL Editor

-- 1. Drop and recreate the trigger function with proper permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.organizers (id, name)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'given_name',
            NEW.email
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 2. Ensure the trigger function has proper ownership and permissions
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- 3. Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- 4. Drop and recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 5. Verify the trigger was created
SELECT
    tgname AS trigger_name,
    tgenabled AS enabled,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
