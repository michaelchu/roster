-- Auto-trigger send-push edge function when notifications are queued
-- Uses pg_net to make HTTP calls to the edge function

-- Update the trigger function to use configurable URL from app_config
CREATE OR REPLACE FUNCTION public.trigger_send_push()
RETURNS TRIGGER AS $$
DECLARE
  service_key TEXT;
  supabase_url TEXT;
BEGIN
  -- Get config values
  SELECT value INTO service_key FROM private.app_config WHERE key = 'service_role_key';
  SELECT value INTO supabase_url FROM private.app_config WHERE key = 'supabase_url';

  -- Default to production URL if not configured
  IF supabase_url IS NULL THEN
    supabase_url := 'https://tubnfhagzcodvaklfscu.supabase.co';
  END IF;

  IF service_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'apikey', service_key,
        'Authorization', 'Bearer ' || service_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on notification_queue table
-- Uses AFTER INSERT and fires once per statement (not per row) to batch process
DROP TRIGGER IF EXISTS trigger_notification_queue_send_push ON notification_queue;

CREATE TRIGGER trigger_notification_queue_send_push
  AFTER INSERT ON notification_queue
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_send_push();

-- Add comment explaining the setup
COMMENT ON FUNCTION public.trigger_send_push() IS
'Triggers the send-push edge function when notifications are added to the queue.
Requires config in private.app_config:
- service_role_key: The Supabase service role key
- supabase_url: The Supabase project URL (defaults to production if not set)

For local development, run:
  INSERT INTO private.app_config (key, value) VALUES
    (''service_role_key'', ''your-local-service-key''),
    (''supabase_url'', ''http://127.0.0.1:54321'')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
';
