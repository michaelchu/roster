-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Note: pg_cron is only available in hosted Supabase, not local development
-- The cron job for process-scheduled was set up manually in production

-- Set up a webhook trigger to call send-push when items are added to notification_queue
-- This ensures notifications are sent immediately when triggered
CREATE OR REPLACE FUNCTION public.trigger_send_push()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://tubnfhagzcodvaklfscu.supabase.co/functions/v1/send-push',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1Ym5maGFnemNvZHZha2xmc2N1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgwOTQ5OCwiZXhwIjoyMDc0Mzg1NDk4fQ.SSe0ipcymQI-_mLP4TIpkcO8sbNe9JArIt6_OrDXLyk", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on notification_queue insert
DROP TRIGGER IF EXISTS on_notification_queue_insert ON public.notification_queue;
CREATE TRIGGER on_notification_queue_insert
  AFTER INSERT ON public.notification_queue
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_send_push();
