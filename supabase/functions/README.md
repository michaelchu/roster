# Supabase Edge Functions

This directory contains Edge Functions for the push notification system.

## Functions

### `send-push`

Processes the notification queue and sends push notifications to subscribed devices.

**Trigger:**
- Database webhook when items are added to `notification_queue`
- Manual invocation for testing
- Called by `process-scheduled` function

**Environment Variables Required:**
- `VAPID_PUBLIC_KEY` - Web Push VAPID public key
- `VAPID_PRIVATE_KEY` - Web Push VAPID private key
- `VAPID_SUBJECT` - VAPID subject (e.g., `mailto:your@email.com`)

### `process-scheduled`

Handles time-based notifications like payment reminders (24hr after event).

**Trigger:**
- Cron job (recommended: every hour)
- Can be set up via Supabase Dashboard or pg_cron

## Setup

### 1. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

### 2. Configure Secrets

```bash
# Set VAPID keys as secrets
supabase secrets set VAPID_PUBLIC_KEY=your_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_private_key
supabase secrets set VAPID_SUBJECT=mailto:your@email.com
```

### 3. Deploy Functions

```bash
# Deploy all functions
supabase functions deploy send-push
supabase functions deploy process-scheduled
```

### 4. Set Up Cron Job (for scheduled notifications)

In Supabase Dashboard:
1. Go to Database > Extensions
2. Enable `pg_cron` extension
3. Create a cron job:

```sql
-- Run process-scheduled every hour
SELECT cron.schedule(
  'process-scheduled-notifications',
  '0 * * * *',  -- Every hour
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/process-scheduled',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

## Local Development

### 1. Generate VAPID Keys for Local Development

```bash
npx web-push generate-vapid-keys --json
```

### 2. Configure Frontend Environment

Add the public key to your root `.env` file:

```bash
VITE_VAPID_PUBLIC_KEY=your_generated_public_key
```

### 3. Configure Edge Function Environment

Create `supabase/.env.local` with all three VAPID keys:

```bash
VAPID_PUBLIC_KEY=your_generated_public_key
VAPID_PRIVATE_KEY=your_generated_private_key
VAPID_SUBJECT=mailto:your@email.com
```

### 4. Configure Database Trigger

The database trigger uses `pg_net` to call the edge function. Since `pg_net` runs inside Docker, it needs `host.docker.internal` to reach your host machine:

```sql
INSERT INTO private.app_config (key, value) VALUES
  ('service_role_key', 'your_local_service_role_key'),
  ('supabase_url', 'http://host.docker.internal:54321')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

The local service role key can be found in your `.env` file as `SUPABASE_SERVICE_ROLE_KEY`.

### 5. Start Edge Functions

```bash
npx supabase functions serve --env-file supabase/.env.local
```

### 6. Test the Full Pipeline

```bash
# Test send-push directly
curl -X POST http://localhost:54321/functions/v1/send-push \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test process-scheduled
curl -X POST http://localhost:54321/functions/v1/process-scheduled \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test full pipeline by inserting into notification_queue
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
INSERT INTO notification_queue (recipient_user_id, notification_type, title, body, scheduled_for, status)
VALUES ('your_user_id', 'test', 'Test Push', 'Hello from local!', NOW(), 'pending');
"
```

**Notes:**
- Local VAPID keys are different from production. Push subscriptions created locally won't work in production and vice versa.
- Ensure your system allows notifications from your browser. On macOS: System Settings → Notifications → Chrome (or your browser) → Allow Notifications. Without this, push notifications will be sent successfully but won't appear on your device.

## Production Implementation Notes

The `send-push` function already sends Web Push notifications using the `web-push` library
and VAPID keys configured via environment variables.

In production, you may want to review and customize the implementation (e.g., error handling,
logging, retries, and payload format). The core pattern looks like this:

1. **Using a Web Push library (current implementation pattern)**
   ```typescript
   import webpush from 'npm:web-push';
   webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
   await webpush.sendNotification(subscription, payload);
   - Requires ECDH key exchange
   - AES-GCM encryption
   - HTTP/2 for efficient delivery
