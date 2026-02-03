# Roster - Mobile Event Signup Platform

A mobile-first event management platform built with React, TypeScript, and Supabase.

## Features

### For Participants
- **Mobile-Only Access** - Platform enforces mobile device usage
- **Quick Signup** - Simple form-based registration for events
- **Quick Fill** - Auto-fills participant information from localStorage
- **Custom Fields** - Support for event-specific custom fields
- **Confirmation Screen** - Shows registration success

### For Organizers
- **Event Management** - Create, view, and manage events
- **Participant Management** - View all registered participants
- **Label System** - Organize participants with custom labels
- **Event Duplication** - Copy events with all settings and labels
- **CSV Export** - Download participant lists with labels
- **Real-time Updates** - Live participant counts and registration

### Design
- **WeChat-Style UI** - Compact, dense layouts with minimal whitespace
- **List-Based Interface** - No floating cards, everything in lists
- **Mobile Navigation** - Persistent bottom navigation bar
- **Responsive** - Optimized for mobile screens only

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: localStorage for Quick Fill

## Database Schema

The app uses the following tables:
- `organizers` - User profiles linked to Supabase Auth
- `events` - Event information with custom fields
- `participants` - Event registrations
- `labels` - Event-specific participant labels
- `participant_labels` - Many-to-many relationship for labels

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set up Environment Variables**
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

3. **Run Database Migration**
   Execute the SQL in `supabase/migrations/001_initial_schema.sql` in your Supabase SQL Editor

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Usage

### Creating an Event
1. Sign up/login as an organizer
2. Navigate to Events tab
3. Click "New" to create an event
4. Add event details and custom fields
5. Share the signup link with participants

### Managing Participants
1. View participants in the event detail page
2. Add/remove labels for organization
3. Export participant data to CSV
4. Search and filter participants

### Participant Registration
1. Participants access the signup link on mobile
2. Fill out the registration form
3. Information is saved for Quick Fill on future events
4. Confirmation screen shows successful registration

## Key Files

- `src/App.tsx` - Main app with routing
- `src/hooks/useAuth.tsx` - Authentication context
- `src/lib/supabase.ts` - Database client and types
- `src/components/BottomNav.tsx` - Mobile navigation
- `src/components/MobileOnly.tsx` - Desktop restriction
- `supabase/migrations/001_initial_schema.sql` - Database schema

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Edge Functions

The `supabase/functions` directory contains Edge Functions for the push notification system.

### Functions

#### `send-push`
Processes the notification queue and sends push notifications to subscribed devices.

**Trigger:**
- Database webhook when items are added to `notification_queue`
- Manual invocation for testing
- Called by `process-scheduled` function

**Environment Variables Required:**
- `VAPID_PUBLIC_KEY` - Web Push VAPID public key
- `VAPID_PRIVATE_KEY` - Web Push VAPID private key
- `VAPID_SUBJECT` - VAPID subject (e.g., `mailto:your@email.com`)

#### `process-scheduled`
Handles time-based notifications like payment reminders (24hr after event).

**Trigger:**
- Cron job (recommended: every hour)
- Can be set up via Supabase Dashboard or pg_cron

### Edge Functions Setup

#### 1. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys
```

#### 2. Configure Secrets

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_private_key
supabase secrets set VAPID_SUBJECT=mailto:your@email.com
```

#### 3. Deploy Functions

```bash
supabase functions deploy send-push
supabase functions deploy process-scheduled
```

#### 4. Set Up Cron Job (for scheduled notifications)

In Supabase Dashboard:
1. Go to Database > Extensions
2. Enable `pg_cron` extension
3. Create a cron job:

```sql
SELECT cron.schedule(
  'process-scheduled-notifications',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/process-scheduled',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

### Local Edge Functions Development

#### 1. Generate VAPID Keys

```bash
npx web-push generate-vapid-keys --json
```

#### 2. Configure Frontend Environment

Add the public key to your root `.env` file:

```bash
VITE_VAPID_PUBLIC_KEY=your_generated_public_key
```

#### 3. Configure Edge Function Environment

Create `supabase/.env.local` with all three VAPID keys:

```bash
VAPID_PUBLIC_KEY=your_generated_public_key
VAPID_PRIVATE_KEY=your_generated_private_key
VAPID_SUBJECT=mailto:your@email.com
```

#### 4. Configure Database Trigger

The database trigger uses `pg_net` to call the edge function. Since `pg_net` runs inside Docker, it needs `host.docker.internal` to reach your host machine:

```sql
INSERT INTO private.app_config (key, value) VALUES
  ('service_role_key', 'your_local_service_role_key'),
  ('supabase_url', 'http://host.docker.internal:54321')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

The local service role key can be found in your `.env` file as `SUPABASE_SERVICE_ROLE_KEY`.

#### 5. Start Edge Functions

```bash
npx supabase functions serve --env-file supabase/.env.local
```

#### 6. Test the Full Pipeline

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
- Ensure your system allows notifications from your browser. On macOS: System Settings → Notifications → Chrome (or your browser) → Allow Notifications.

## License

MIT License
