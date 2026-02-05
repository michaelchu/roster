# Roster - Mobile Event Signup Platform

A mobile-first event management platform built with React, TypeScript, and Supabase.

## Features

### For Participants
- **Event Signup** - Register for events via shareable links
- **Quick Fill** - Auto-fills participant information from localStorage
- **Custom Fields** - Support for event-specific form fields
- **Waitlist** - Join waitlist when events are full
- **Push Notifications** - Get notified about event updates, cancellations, and waitlist promotions

### For Organizers
- **Event Management** - Create, edit, duplicate, and delete events
- **Group Management** - Organize events and members into groups with role-based access
- **Participant Management** - View, search, and manage registered participants
- **Label System** - Organize participants with custom labels
- **Payment Tracking** - Track payment status for participants
- **CSV Export** - Download participant lists with labels
- **Push Notifications** - Get notified about new signups, withdrawals, and capacity changes
- **Private Events** - Restrict event visibility to group members

### Design
- **Mobile-First** - Optimized for mobile screens with bottom navigation
- **Dark Mode** - Theme toggle with system preference support
- **Adjustable Font Size** - Customizable text size for accessibility

## Tech Stack

- **Frontend**: Vite + React 19 + TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Authentication**: Supabase Auth with Google OAuth
- **Push Notifications**: Web Push API with VAPID
- **Testing**: Vitest + Playwright
- **Storage**: localStorage for Quick Fill and appearance settings

## Database Schema

The app uses the following tables:
- `organizers` - User profiles linked to Supabase Auth
- `events` - Event information with custom fields
- `participants` - Event registrations
- `labels` - Event-specific participant labels
- `participant_labels` - Many-to-many relationship for labels
- `groups` - Event groups for organizing related events
- `notification_preferences` - User push notification settings
- `push_subscriptions` - Web Push subscription data per device
- `notifications` - Notification inbox/history
- `notification_queue` - Queue for pending push notifications
- `feature_flags` - Platform-wide feature toggles
- `feature_flag_overrides` - User/group-level feature flag overrides

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
   VITE_GOOGLE_CLIENT_ID=your-google-client-id
   ```

3. **Start Local Supabase**
   ```bash
   npx supabase start
   ```

4. **Apply Database Migrations**
   ```bash
   npx supabase migration up
   ```

5. **Start Development Server**
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
- `src/hooks/useNotifications.ts` - Push notification state management
- `src/hooks/useFeatureFlags.ts` - Feature flag system
- `src/lib/supabase.ts` - Database client and types
- `src/services/` - Business logic and database abstraction layer
- `src/components/BottomNav.tsx` - Mobile navigation
- `src/components/MobileOnly.tsx` - Desktop restriction
- `supabase/migrations/` - Database migrations (applied via `npx supabase migration up`)
- `supabase/functions/` - Edge functions for push notifications

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

## Testing

### Unit Tests

```bash
npm run test          # Run Vitest test suite
npm run test:ui       # Interactive Vitest UI
npm run test:coverage # Generate coverage reports
```

### E2E Tests

E2E tests use Playwright. All required services are automatically started.

#### Prerequisites

1. **Docker must be running** (required for Supabase)

2. **Ensure environment variables are set** in `.env`:
   - `VITE_SUPABASE_URL` - Your local Supabase URL (default: `http://127.0.0.1:54321`)
   - `VITE_SUPABASE_ANON_KEY` - Get from `npx supabase status` (shown as "Publishable" key)
   - `SUPABASE_SERVICE_ROLE_KEY` - Get from `npx supabase status` (shown as "Secret" key)

#### Running E2E Tests

```bash
npm run test:e2e         # Run all E2E tests
npm run test:e2e:ui      # Run with Playwright UI
npm run test:e2e:headed  # Run with visible browser
```

Playwright automatically starts:
- Supabase (if not already running)
- Vite dev server (port 5173)
- Supabase edge functions (port 54321)

#### Troubleshooting

- **Tests failing with RLS/permission errors**: Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env`
- **Supabase fails to start**: Ensure Docker is running
- **Edge functions timeout**: Check Docker has enough resources allocated

## License

Proprietary - All rights reserved.
