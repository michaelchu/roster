-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule process-scheduled function to run every hour
-- This handles time-based notifications like payment reminders
SELECT cron.schedule(
  'process-scheduled-notifications',
  '0 * * * *',  -- Every hour at minute 0
  $$
  SELECT net.http_post(
    url := 'https://tubnfhagzcodvaklfscu.supabase.co/functions/v1/process-scheduled',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1Ym5maGFnemNvZHZha2xmc2N1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODgwOTQ5OCwiZXhwIjoyMDc0Mzg1NDk4fQ.SSe0ipcymQI-_mLP4TIpkcO8sbNe9JArIt6_OrDXLyk", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Also set up a webhook trigger to call send-push when items are added to notification_queue
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
