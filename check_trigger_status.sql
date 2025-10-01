-- Complete diagnostic for the trigger issue
-- Run this entire script in your Supabase SQL Editor

-- Query 1: Check if the trigger exists
SELECT
    'Trigger exists on auth.users' as check_type,
    CASE
        WHEN COUNT(*) > 0 THEN 'YES ✓'
        ELSE 'NO ✗ - TRIGGER IS MISSING'
    END as status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
AND c.relname = 'users'
AND t.tgname = 'on_auth_user_created';

-- Query 2: Check if the trigger function exists
SELECT
    'Trigger function exists' as check_type,
    CASE
        WHEN COUNT(*) > 0 THEN 'YES ✓'
        ELSE 'NO ✗ - FUNCTION IS MISSING'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'handle_new_user';

-- Query 3: Show the actual trigger function code (if it exists)
SELECT
    n.nspname as schema,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'handle_new_user';

-- Query 4: Check if there are ANY triggers on auth.users
SELECT
    t.tgname as trigger_name,
    p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'auth'
AND c.relname = 'users';
