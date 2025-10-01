-- Fix missing organizer records for users who were manually confirmed
-- This creates organizer records for any users who don't have one

-- Insert organizer records for users without them
INSERT INTO public.organizers (id, name)
SELECT
    u.id,
    COALESCE(
        u.raw_user_meta_data->>'name',
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'given_name',
        u.email
    ) as name
FROM auth.users u
LEFT JOIN public.organizers o ON u.id = o.id
WHERE o.id IS NULL;

-- Verify all users now have organizer records
SELECT
    u.id as user_id,
    u.email,
    u.email_confirmed_at,
    o.id as organizer_id,
    o.name as organizer_name
FROM auth.users u
LEFT JOIN public.organizers o ON u.id = o.id
ORDER BY u.created_at DESC;
