-- Diagnostic queries to check login-related issues

-- 1. Check if the user exists and is confirmed
SELECT
    id,
    email,
    email_confirmed_at,
    created_at,
    last_sign_in_at,
    encrypted_password IS NOT NULL as has_password
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check if organizer record exists for the user
SELECT
    u.id as user_id,
    u.email,
    o.id as organizer_id,
    o.name as organizer_name,
    o.created_at as organizer_created_at
FROM auth.users u
LEFT JOIN public.organizers o ON u.id = o.id
ORDER BY u.created_at DESC
LIMIT 5;

-- 3. Check RLS policies on organizers table
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'organizers';

-- 4. Test if current user can access organizers table
SELECT * FROM public.organizers LIMIT 1;
