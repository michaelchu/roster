-- Diagnostic SQL to check the organizers table and trigger setup
-- Run this in your Supabase SQL Editor to diagnose the issue

-- 1. Check if organizers table exists
SELECT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'organizers'
) AS organizers_table_exists;

-- 2. Check if the trigger function exists
SELECT EXISTS (
    SELECT FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user'
) AS trigger_function_exists;

-- 3. Check if the trigger exists on auth.users
SELECT EXISTS (
    SELECT FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'auth'
    AND c.relname = 'users'
    AND t.tgname = 'on_auth_user_created'
) AS trigger_exists;

-- 4. Show the current trigger function definition
SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'handle_new_user';

-- 5. Check organizers table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'organizers'
ORDER BY ordinal_position;
