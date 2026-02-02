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

```bash
# Start functions locally
supabase functions serve

# Test send-push
curl -X POST http://localhost:54321/functions/v1/send-push \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test process-scheduled
curl -X POST http://localhost:54321/functions/v1/process-scheduled \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

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
