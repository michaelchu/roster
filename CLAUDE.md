# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Detailed Reference Documentation

For in-depth technical references, see the `/docs/` directory:
- [`docs/DATABASE.md`](docs/DATABASE.md) — Complete database schema: all tables, columns, RLS policies, triggers, and RPC functions
- [`docs/SERVICES.md`](docs/SERVICES.md) — Service layer patterns, error handling conventions, Supabase query recipes
- [`docs/TESTING.md`](docs/TESTING.md) — Test setup, Supabase mocking patterns, fixtures, E2E conventions
- [`docs/FRONTEND.md`](docs/FRONTEND.md) — Routing, provider hierarchy, hook reference, component patterns

Consult these when working on database changes, adding services, writing tests, or building UI.

## Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in required environment variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key for E2E tests (bypasses RLS)
   - `VITE_GOOGLE_CLIENT_ID` - Google OAuth client ID for authentication
   - `VITE_VAPID_PUBLIC_KEY` - VAPID public key for push notifications (generate with `npx web-push generate-vapid-keys`)
   - `VITE_SENTRY_DSN` - (optional) Sentry DSN for error tracking
   - `VITE_SENTRY_ENVIRONMENT` - (optional) Sentry environment label
   - `VITE_MIXPANEL_TOKEN` - (optional) Mixpanel project token for analytics

3. Start local Supabase:
   ```bash
   npx supabase start
   ```

4. Edge functions also need a `supabase/.env` file with:
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` - VAPID keypair for sending push notifications
   - `VAPID_SUBJECT` - Contact email (e.g., `mailto:notifications@roster.app`)
   - `SENTRY_DSN` / `SENTRY_ENVIRONMENT` - (optional) Error tracking for edge functions

## Development Commands

**Build & Development:**
- `npm run dev` - Start Vite dev server + Supabase edge functions (via concurrently)
- `npm run dev:vite` - Start Vite dev server only (no edge functions)
- `npm run build` - TypeScript compilation + Vite production build
- `npm run preview` - Preview production build
- `npm start` - Production preview with host binding

**Code Quality:**
- `npm run lint` - ESLint with modern flat config
- `npm run format` - Prettier formatting for all source files
- `npm run format:check` - Check formatting without modification

**Testing:**
- `npm run test` - Run Vitest unit/integration test suite
- `npm run test:ui` - Interactive Vitest UI
- `npm run test:coverage` - Generate test coverage reports
- `npm run test:e2e` - Run Playwright end-to-end tests (requires Supabase running)
- `npm run test:e2e:ui` - Run E2E tests with Playwright UI
- `npm run test:e2e:headed` - Run E2E tests with visible browser
- `npm run test:e2e:debug` - Run E2E tests with Playwright debugger

**Git Hooks:**
- Pre-commit: Auto-formats code with Prettier
- Pre-push: Runs unit tests, lint, typecheck, and E2E tests (if Supabase is running)

**Database & Migrations:**
- `npm run supabase:start` - Start local Supabase instance (also called automatically by `npm run dev`)
- `npx supabase stop` - Stop local Supabase instance
- `npx supabase migration list` - List all migrations and their status
- `npx supabase migration new <name>` - Create a new migration file
- `npx supabase migration up` - Apply pending migrations to local database
- To re-seed local database: `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/seed.sql`
- **Always apply migrations instead of resetting the database** - use `migration up` to preserve local data
- **CI/CD automatically applies migrations to production** when code is pushed to main - no manual `db push` needed

**IMPORTANT - Commands Requiring Explicit Permission:**
- **NEVER** run `npx supabase db reset` unless explicitly told to - this wipes all local data
- **NEVER** run `npx supabase db push` unless explicitly told to - CI/CD handles production migrations automatically
- **NEVER** run `git push` unless explicitly told to - only commit changes, don't push to remote

## High-Level Architecture

### Project Structure
This is a **mobile-first React event management platform** with a service layer architecture:

```
src/
├── components/          # UI components with shadcn/ui integration
├── hooks/              # Custom React hooks (useAuth, useFeatureFlags, useNotifications)
├── lib/                # Core utilities (Supabase client, validation, error handling)
├── pages/              # Route-based page components
├── services/           # Business logic & database abstraction layer
├── types/              # TypeScript type definitions
└── test/               # Testing utilities, mocks, fixtures
supabase/
├── functions/           # Deno edge functions (send-push, process-scheduled)
├── migrations/          # PostgreSQL migration files
└── seed.sql             # Local seed data
public/
└── sw-push.js           # Service worker for push notifications
```

### Key Architectural Patterns

**Service Layer Pattern:** All business logic lives in `/src/services/` with typed interfaces. Services handle Supabase database interactions and provide clean APIs to React components.

**Mobile-Only Enforcement:** The app uses a `MobileOnly` component to restrict access to mobile devices only, reflecting its WeChat-inspired dense UI design.

**Authentication Flow:** Supabase Auth with automatic organizer profile creation via database triggers. Authentication state managed through custom `useAuth` hook.

### Technology Stack
- **Frontend:** React 19 + TypeScript (strict mode) + Vite
- **UI:** Tailwind CSS + shadcn/ui (New York style) + Radix UI primitives
- **Backend:** Supabase (PostgreSQL with Row Level Security)
- **Testing:** Vitest + Testing Library + MSW for API mocking + Playwright for E2E tests
- **Routing:** React Router DOM v7

### Database Schema
Core tables: `organizers`, `events`, `participants`, `labels`, `participant_labels`, `participant_activity_log`
Notification tables: `notifications`, `notification_queue`, `push_subscriptions`, `notification_preferences`
- **JSONB fields** for flexible custom form fields in events
- **Row Level Security (RLS)** enabled on all tables with comprehensive policies
- **Public signup access** for participants, protected organizer data
- **RPC functions** for cross-user operations: `queue_notification()`, `upsert_push_subscription()`

### Service Layer
Services are typed and handle all database interactions:
- `eventService.ts` - Event CRUD with participant counting
- `participantService.ts` - Registration management and CSV export
- `labelService.ts` - Participant categorization
- `organizerService.ts` - User profile management
- `groupService.ts` - Group management with contacts and stats
- `featureFlagService.ts` - Feature flag resolution with caching
- `notificationService.ts` - In-app notification inbox and queue management
- `pushSubscriptionService.ts` - Web Push API subscription lifecycle
- `notificationPreferenceService.ts` - Per-user notification preferences
- `participantActivityService.ts` - Activity logging for participant actions

All services export from `/src/services/index.ts` for clean imports.

### Feature Flags
Feature flags are stored in the database with support for platform-wide defaults and user/group overrides.

**Available flags:**
- `csv_export` - CSV export functionality
- `registration_form` - Custom registration form fields
- `event_duplication` - Event duplication feature
- `home_page` - Home page visibility
- `event_privacy` - Event privacy settings
- `guest_registration` - Guest registration flow
- `debug_notifications` - Debug panel for testing notifications

**Usage:**
```tsx
const { isEnabled } = useFeatureFlags();
if (isEnabled('registration_form')) { /* render feature */ }
```

Feature flags are cached for 5 minutes and support user-level and group-level overrides.

### Notification System

The app has a two-part notification system: an **in-app inbox** and **Web Push notifications**.

**Notification Types:**
`new_signup`, `withdrawal`, `payment_received`, `capacity_reached`, `signup_confirmed`, `event_updated`, `event_cancelled`, `payment_reminder`, `waitlist_promotion`

**In-App Notifications (Inbox):**
- Notifications are queued from application code (not database triggers) via `notificationService.queueXxx()` methods
- Queuing uses an RPC function (`queue_notification`) with `SECURITY DEFINER` to bypass RLS and allow cross-user notifications
- The `NotificationCenter` component shows the inbox drawer with real-time updates via Supabase postgres_changes
- Services like `participantService` call queue methods using `fireAndForget()` so notification failures don't block user actions

**Push Notifications (Web Push API):**
- Browser subscription managed by `pushSubscriptionService` using VAPID keys
- VAPID public key is stored in IndexedDB so the service worker (`public/sw-push.js`) can access it for re-subscription
- `push_subscriptions` table tracks active device subscriptions per user, with endpoint uniqueness handling for device switching
- `notification_preferences` table stores per-user toggles for each notification type plus a master `push_enabled` toggle
- `useNotifications` hook manages the full lifecycle: subscription state, real-time inbox updates, and database sync

**Edge Functions (Deno):**
- `send-push` - Processes the notification queue: claims pending items with optimistic locking, checks user preferences, sends Web Push to all active subscriptions, saves to inbox, handles retries (max 3 attempts), and deactivates stale subscriptions (404/410). Triggered by a database webhook (`pg_net`) on queue insert for instant delivery.
- `process-scheduled` - Finds events that ended 24 hours ago, queues `payment_reminder` notifications for unpaid participants with deduplication, then invokes `send-push`. Triggered hourly by `pg_cron` in production (not available locally).

**Local Development:**
- `npm run dev` auto-starts edge functions via concurrently
- Push notifications work locally — see the README for required database/webhook setup
- The debug panel (`debug_notifications` feature flag) can be used to test notification queuing and inbox delivery
- `pg_cron` is not available locally, so `process-scheduled` must be invoked manually for testing

### Testing Approach
- **Service layer unit tests** with mocked Supabase client
- **Component integration tests** using Testing Library
- **End-to-end tests** with Playwright for browser automation
- **Test fixtures** in `/src/test/fixtures/` for reusable test data
- **MSW mocking** for API endpoints during testing
- **Isolated test environments** - E2E tests in `/tests/` folder, unit tests in `/src/test/`

### Code Quality Standards
- **TypeScript strict mode** enforced with comprehensive type checking
- **ESLint flat config** with React-specific rules
- **Prettier formatting** (single quotes, 100 char width)
- **Path aliases:** `@/*` maps to `./src/*`

### Mobile-First Design Philosophy
- WeChat-inspired compact UI with minimal whitespace
- Bottom navigation for thumb-friendly mobile access
- Dense information display optimized for mobile screens
- Device detection enforces mobile-only usage