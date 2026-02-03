-- SECURITY FIX: Remove hardcoded service role key from cron job and trigger
-- The previous migration contained a hardcoded service_role_key which is a security risk.
-- This migration fixes that by using a secure config table approach.

-- Step 1: Remove the insecure cron job (only if pg_cron is available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule('process-scheduled-notifications');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if cron job doesn't exist
END $$;

-- Step 2: Create a secure config table in the private schema
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Restrict access to the config table
ALTER TABLE private.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.app_config FROM anon, authenticated;

-- Step 3: Create helper function to get the service role key securely
CREATE OR REPLACE FUNCTION private.get_service_role_key()
RETURNS TEXT AS $$
  SELECT value FROM private.app_config WHERE key = 'service_role_key';
$$ LANGUAGE sql SECURITY DEFINER;

-- Step 4: Replace the trigger function with a secure version
CREATE OR REPLACE FUNCTION public.trigger_send_push()
RETURNS TRIGGER AS $$
DECLARE
  service_key TEXT;
  supabase_url TEXT := 'https://tubnfhagzcodvaklfscu.supabase.co';
BEGIN
  SELECT private.get_service_role_key() INTO service_key;

  IF service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MANUAL STEPS REQUIRED AFTER APPLYING THIS MIGRATION:
-- ============================================================================
--
-- 1. Add the service role key to the secure config table:
--    INSERT INTO private.app_config (key, value)
--    VALUES ('service_role_key', 'YOUR_SERVICE_ROLE_KEY');
--
-- 2. Re-create the cron job with the secure approach:
--    SELECT cron.schedule(
--      'process-scheduled-notifications',
--      '0 * * * *',
--      $$
--      SELECT net.http_post(
--        url := 'https://tubnfhagzcodvaklfscu.supabase.co/functions/v1/process-scheduled',
--        headers := jsonb_build_object(
--          'Authorization', 'Bearer ' || (SELECT value FROM private.app_config WHERE key = 'service_role_key'),
--          'Content-Type', 'application/json'
--        ),
--        body := '{}'::jsonb
--      );
--      $$
--    );
--
-- 3. IMPORTANT: Rotate your service_role_key in Supabase Dashboard since
--    the old key was exposed in git history:
--    Dashboard > Project Settings > API > Regenerate service_role key
-- ============================================================================
