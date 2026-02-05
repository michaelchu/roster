# Frontend Patterns Reference

This document is a reference for AI coding assistants working on the Roster frontend. It covers provider hierarchy, routing, hooks, component patterns, and conventions. For project setup, commands, architecture overview, and backend details, see `/CLAUDE.md`.

---

## 1. Provider Hierarchy

Providers wrap the application in this order (outermost to innermost) in `App.tsx`:

```
ErrorBoundary                          — catches unhandled errors globally
  └─ ThemeProvider                     — dark/light mode (storage key: "roster-theme")
      └─ FontSizeProvider              — sm/md/lg font size with CSS variables
          └─ MobileOnly                — blocks rendering if viewport >= 768px
              └─ BrowserRouter         — React Router DOM v7
                  └─ AuthProvider      — Supabase auth state + session management
                      └─ FeatureFlagsProvider  — flag resolution with 5-min auto-refresh
                          └─ AppContent        — routes + BottomNav
                          └─ Toaster           — Sonner toast notifications
```

Key implications:

- `useAuth()` is only available inside `BrowserRouter` and below.
- `FeatureFlagsProvider` depends on `AuthProvider` (flags can have user-level overrides).
- `MobileOnly` sits above the router, so non-mobile users never reach any route.
- `FontSizeProvider` is above `MobileOnly`, so font preferences persist even when the mobile gate blocks rendering.

---

## 2. Route Map

| Path | Component | Auth | Notes |
|------|-----------|------|-------|
| `/` | `HomePageOrRedirect` | No | Redirects to `/events` if `home_page` flag disabled |
| `/auth/login` | `LoginPage` | No | Public |
| `/auth/register` | `RegisterPage` | No | Public |
| `/invite/:type/:id` | `InviteConfirmationPage` | No | Event/group invite confirmation |
| `/signup/:eventId` | `EventDetailLayout` | No | Public event signup |
| `/signup/:eventId/edit` | `EditEventPage` | Yes | Edit own registration |
| `/events` | `EventsLayout` | Yes | Protected |
| `/events/new` | `NewEventPage` | Yes | Protected |
| `/events/:eventId/edit` | `EditEventPage` | Yes | Protected |
| `/groups` | `GroupsLayout` | Yes | Protected |
| `/groups/new` | `NewGroupPage` | Yes | Protected |
| `/groups/:groupId` | `GroupDetailLayout` | Yes | Protected |
| `/groups/:groupId/edit` | `EditGroupPage` | Yes | Protected |
| `/groups/:groupId/events/new` | `NewEventPage` | Yes | Protected |
| `/groups/:groupId/participants` | `GroupParticipantsPage` | Yes | Protected |
| `/groups/:groupId/manage-roles` | `ManageRolesPage` | Yes | Protected |
| `/groups/:groupId/remove-members` | `RemoveMembersPage` | Yes | Protected |
| `/settings` | `SettingsPage` | Yes | Protected |
| `/profile` | `ProfilePage` | Yes | Protected |
| `*` | 404 Page | - | "Page not found" + "Go back" button |

---

## 3. Auth Guard

`ProtectedRoute` wraps routes that require authentication:

```typescript
<Route path="/events" element={<ProtectedRoute><EventsLayout /></ProtectedRoute>} />
```

Behavior:

1. **Auth loading** -- renders a centered "Loading..." spinner.
2. **No user** -- stores the current path in `localStorage('returnUrl')`, then redirects to `/auth/login`.
3. **User exists** -- renders children normally.

Post-login, `AuthProvider` checks `returnUrl` in localStorage, then `pendingInvite`, then falls back to a default route.

---

## 4. Bottom Navigation

`BottomNav` is fixed to the bottom of the screen (`z-50`). Only shown to authenticated users.

### Items

| Icon | Label | Path | Conditional |
|------|-------|------|-------------|
| `Home` | Home | `/` | Only when `home_page` flag is enabled |
| `Calendar` | Events | `/events` | Always |
| `Users` | Groups | `/groups` | Always |
| `Settings` | Settings | `/settings` | Always |

### Hidden on these routes

- `/auth/*` (login, register)
- `/invite/*` (invite pages)
- `/signup/*` when user is NOT authenticated
- `/events/new`
- `/events/:eventId/edit`
- `/signup/:eventId/edit`
- `/groups/new`
- `/groups/:groupId/edit`
- `/groups/:groupId/events/new`

---

## 5. Top Navigation

`TopNav` renders the page header with logo, notifications, and an optional close button.

```typescript
interface TopNavProps {
  showCloseButton?: boolean;
  closePath?: string;
  onClose?: () => void;
  sticky?: boolean;           // applies sticky top-0 z-10
  className?: string;
  hideNotifications?: boolean;
}
```

### Features

- **Logo**: "Roster BETA" with gradient styling.
- **Right side**: `NotificationCenter` (if authenticated and `hideNotifications` is not set), optional close button.
- **Close navigation priority**: `onClose` callback, then `closePath`, then `history.back()`, then a fallback path.

---

## 6. Hook Reference

### useAuth()

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}
```

Key behaviors:

- Initial load calls `supabase.auth.getSession()`.
- Subscribes to `onAuthStateChange` for real-time session updates.
- Post-login redirect: checks `returnUrl` in localStorage, then `pendingInvite`, then falls back to default.
- `signOut` removes the push subscription from the database to prevent notification leakage to signed-out devices.
- Google auth supports both OAuth redirect flow and ID token flow.

### useFeatureFlags() / useFeatureFlag(key)

```typescript
interface FeatureFlagsContextType {
  flags: FeatureFlags | null;
  loading: boolean;
  error: Error | null;
  isFeatureEnabled: (key: FeatureFlagKey) => boolean;
  refreshFlags: () => Promise<void>;
}

// Single flag shortcut (returns false while loading):
const isEnabled = useFeatureFlag('csv_export');
```

- Auto-refreshes every 5 minutes.
- Fault-tolerant: keeps stale flags if refresh fails.
- Available flag keys: `csv_export`, `registration_form`, `event_duplication`, `home_page`, `event_privacy`, `guest_registration`, `debug_notifications`.

### useNotifications()

```typescript
interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  isSubscribed: boolean;
  permission: NotificationPermission;
  loading: boolean;
  error: Error | null;
  isSupported: boolean;
  isConfigured: boolean;
  subscribe: () => Promise<NotificationPermission>;
  unsubscribe: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<NotificationPreferences>;
  refresh: () => Promise<void>;
  refreshSubscriptionState: () => Promise<void>;
}
```

- Real-time updates via Supabase `postgres_changes` subscription.
- Auto-syncs browser push subscription state to the database.
- `isSupported` checks for Web Push API browser support; `isConfigured` checks for VAPID key availability.

### useLoadingState\<T\>(initialData?)

```typescript
interface UseLoadingStateResult<T> {
  isLoading: boolean;
  error: string | null;
  data: T | null;
  execute: (asyncFn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setData: (data: T | null) => void;
}
```

Variants:

- `useLoadingState<T>(initialData?)` -- manages a single async operation with loading/error/data states.
- `useMultipleLoadingStates<T>(keys)` -- manages independent loading states keyed by string identifiers.
- `useAsyncOperation<T>(operation, deps)` -- auto-runs the operation when dependencies change.

### useFormValidation\<T\>(schema)

```typescript
interface UseFormValidationResult<T> {
  errors: ValidationError[];
  isValid: boolean;
  validate: (data: T) => boolean;
  validateField: (field: keyof T, value: unknown) => boolean;
  clearErrors: () => void;
  clearFieldError: (field: keyof T) => void;
  getFieldError: (field: keyof T) => string | undefined;
}
```

Combined form state and validation via `useValidatedForm`:

```typescript
const { data, updateField, validateAll, errors, isValid } = useValidatedForm(
  { name: '', email: '' },
  z.object({ name: z.string().min(1), email: z.string().email() })
);
```

### useCustomFields(event)

```typescript
interface UseCustomFieldsResult {
  customFields: CustomField[];
  addCustomField: () => void;
  updateCustomField: (id: string, updates: Partial<CustomField>) => void;
  removeCustomField: (id: string) => void;
  resetCustomFields: (fields: CustomField[]) => void;
}

interface CustomField {
  id?: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'select';
  required: boolean;
  options?: string[];   // only used when type is 'select'
}
```

### useFontSize()

```typescript
interface FontSizeContextType {
  fontSize: 'sm' | 'md' | 'lg';
  setFontSize: (size: FontSize) => void;
  fontSizeConfig: FontSizeConfig;
  fontSizeLabels: Record<FontSize, string>;
  getFontSizeValue: (size: FontSize) => string;
}
```

- Sizes: `sm` = 18px, `md` = 20px (default), `lg` = 22px.
- Sets CSS custom properties: `--font-size-base`, `--font-size-xs`, etc.
- Persisted to `localStorage` under the key `"font-size-preference"`.

---

## 7. Page Component Pattern

The canonical pattern used across page components (using `EventDetailPage.tsx` as the reference example):

```typescript
// 1. Imports — organized by category
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { eventService, participantService, labelService } from '@/services';
import { errorHandler, fireAndForget } from '@/lib/errorHandler';
// UI component imports...

// 2. State management
const [event, setEvent] = useState<EventData | null>(null);
const [participants, setParticipants] = useState<Participant[]>([]);
const [loading, setLoading] = useState(true);
const isLoadingRef = useRef(false);  // Prevent concurrent loads

// 3. Feature flags
const csvExportEnabled = useFeatureFlag('csv_export');

// 4. Data loading in useEffect with concurrency guard
useEffect(() => {
  async function loadData() {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      setLoading(true);
      const [eventData, participantData] = await Promise.all([
        eventService.getEvent(eventId),
        participantService.getParticipants(eventId),
      ]);
      setEvent(eventData);
      setParticipants(participantData);
    } catch (err) {
      errorHandler.handle(err, { action: 'load event data' });
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }
  loadData();
}, [eventId]);

// 5. Access control (after data loads)
if (event?.is_private && user && event.organizer_id !== user.id) {
  // Check if user is a participant, redirect if not
}

// 6. Loading skeleton (before data is ready)
if (loading) return <EventDetailSkeleton />;

// 7. Render with conditional features
return (
  <div>
    {csvExportEnabled && <ExportButton />}
    {/* ... */}
  </div>
);
```

Key conventions in this pattern:

- Use `isLoadingRef` to prevent duplicate concurrent data fetches.
- Use `Promise.all` for parallel data loading.
- Use `errorHandler.handle(err, { action })` for user-facing error display via toast.
- Use `fireAndForget()` for non-critical side effects (e.g., queuing notifications).
- Return a skeleton component during loading, not a generic spinner.
- Check feature flags with `useFeatureFlag()` to conditionally render features.

---

## 8. UI Conventions

### Component Library

- **Base components**: shadcn/ui (New York style) built on Radix UI primitives.
- **Icons**: Lucide React (e.g., `import { Calendar, Users, Settings } from 'lucide-react'`).
- **Path alias**: `@/*` maps to `./src/*`.

### Toasts

Use Sonner via the error handler utilities:

```typescript
errorHandler.success('Event created');           // success toast
errorHandler.handle(err, { action: 'save' });    // error toast with context
toast('Custom message');                          // direct Sonner call
```

### Loading States

Each page that loads async data has a dedicated skeleton component:

- `EventDetailSkeleton`
- `EditEventPageSkeleton`
- `ParticipantsPageSkeleton`
- `ProfilePageSkeleton`
- `SettingsPageSkeleton`

### Mobile Overlays

Use `Sheet` or `Drawer` components for mobile-friendly modals and panels instead of traditional modals.

### Forms

- Controlled inputs with `useState`.
- Validation via `useFormValidation` or `useValidatedForm` with Zod schemas.

### Styling

- Tailwind CSS utility classes for all styling.
- CSS custom properties for font sizes (set by `FontSizeProvider`).
- No inline styles or CSS modules.

### Error Handling

- Top-level `ErrorBoundary` catches unhandled render errors.
- Async errors handled with `errorHandler.handle()` which displays a toast.

---

## 9. Key Components

### Layout

| Component | Purpose |
|-----------|---------|
| `ProtectedRoute` | Auth guard -- redirects unauthenticated users to login |
| `MobileOnly` | Enforces mobile viewport (< 768px) |
| `BottomNav` | Fixed bottom navigation bar |
| `TopNav` | Page header with logo, notifications, close button |
| `ErrorBoundary` | Global error catching with fallback UI |

### Feature

| Component | Purpose |
|-----------|---------|
| `NotificationCenter` | Inbox drawer with notification list and actions |
| `SignupFormDrawer` | Event registration form in a bottom sheet |
| `ParticipantDetailsSheet` | Participant info and organizer actions |
| `EventActivityTimeline` | Activity log display for organizers |
| `CustomFieldsEditor` | Editor for event custom form fields |
| `PaymentStatusBadge` | Visual payment status indicator |

### Form

| Component | Purpose |
|-----------|---------|
| `DateTimeInput` | Date and time picker |
| `TbdDateTimeField` | Date input with a "TBD" toggle option |
| `MaxParticipantsInput` | Numeric capacity input |
| `PrivacyToggle` | Event privacy on/off toggle |

### Loading / Skeleton

| Component | Used by |
|-----------|---------|
| `EventDetailSkeleton` | `EventDetailPage` |
| `EditEventPageSkeleton` | `EditEventPage` |
| `ParticipantsPageSkeleton` | Participant list views |
| `ProfilePageSkeleton` | `ProfilePage` |
| `SettingsPageSkeleton` | `SettingsPage` |

---

## 10. Pages List

| File | Description |
|------|-------------|
| `HomePage.tsx` | Home page (feature-flagged via `home_page`) |
| `EventsPage.tsx` | Events list |
| `EventsLayout.tsx` | Events route layout wrapper |
| `EventDetailPage.tsx` | Full event view with participants and signup |
| `EventDetailLayout.tsx` | Event detail layout wrapper |
| `EditEventPage.tsx` | Event edit form |
| `NewEventPage.tsx` | Create new event |
| `GroupsPage.tsx` | Groups list |
| `GroupsLayout.tsx` | Groups route layout wrapper |
| `GroupDetailPage.tsx` | Full group view |
| `GroupDetailLayout.tsx` | Group detail layout wrapper |
| `EditGroupPage.tsx` | Group edit form |
| `NewGroupPage.tsx` | Create new group |
| `GroupParticipantsPage.tsx` | Group participants list |
| `ManageRolesPage.tsx` | Group role management |
| `RemoveMembersPage.tsx` | Remove members from group |
| `SettingsPage.tsx` | User settings (theme, font size, notifications) |
| `ProfilePage.tsx` | User profile management |
| `InviteConfirmationPage.tsx` | Accept event/group invites |
| `LoginPage.tsx` | Email/password and Google login |
| `RegisterPage.tsx` | Account registration |

---

## 11. How to Add a New Page

1. **Create the component** in `src/pages/NewPage.tsx`.

2. **Add the route** in `App.tsx` within `<Routes>`:
   - Public route: `<Route path="/new-path" element={<NewPage />} />`
   - Protected route: `<Route path="/new-path" element={<ProtectedRoute><NewPage /></ProtectedRoute>} />`

3. **Hide BottomNav** if it is a form or modal-style page: add the path pattern to the BottomNav hide list in `AppContent`.

4. **Feature flag** (if needed): `const isEnabled = useFeatureFlag('flag_key');`

5. **Import services** for data access: `import { eventService } from '@/services';`

6. **Handle errors** with `errorHandler.handle(err, { action: 'description' })`.

7. **Add a Skeleton component** for the loading state if the page loads async data. Follow the naming convention: `NewPageSkeleton`.

8. **Follow the page component pattern** from Section 7: state setup, `useEffect` with concurrency guard, loading skeleton return, then full render.
