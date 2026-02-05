# Service Layer Patterns Reference

Reference for AI coding assistants working with the service layer in this codebase.

## 1. Service Structure

All services are **plain objects** (not classes) with async methods. They are exported from `src/services/index.ts`.

```typescript
// src/services/index.ts
export { eventService } from './eventService';
export type { Event, Label as EventLabel } from './eventService';
export { participantService } from './participantService';
export type { Participant, Label as ParticipantLabel } from './participantService';
export { labelService } from './labelService';
export type { Label } from './labelService';
export { organizerService } from './organizerService';
export type { Organizer } from './organizerService';
export { groupService } from './groupService';
export type { Group, GroupParticipant, GroupStats, GroupContact } from './groupService';
export { featureFlagService } from './featureFlagService';
export { notificationService } from './notificationService';
export { pushSubscriptionService } from './pushSubscriptionService';
export { notificationPreferenceService } from './notificationPreferenceService';
export { participantActivityService } from './participantActivityService';
export type { ParticipantActivity, ParticipantActivityType } from './participantActivityService';
```

Each service file follows the same structure:
1. Imports (supabase client, error handling, session validation, types)
2. Domain type definition (extending database types if needed)
3. Optional DB-to-domain converter function
4. Exported service object with async methods

---

## 2. Error Handling

Source: `src/lib/errorHandler.ts`

### Error Class Hierarchy

```
AppError (base)
  code?: string
  userMessage?: string
  |
  +-- NetworkError     code: 'NETWORK_ERROR'
  +-- ValidationError  code: 'VALIDATION_ERROR'
  +-- AuthError        code: 'AUTH_ERROR'
  +-- DatabaseError    code: 'DATABASE_ERROR'
```

### Critical Functions

#### `throwIfSupabaseError<T>(result: { data: T; error: unknown }): T`

Throws an `AppError` if the Supabase result contains an error. Returns `data` if no error.

Supabase error code mapping inside `errorHandler.fromSupabaseError()`:
- `PGRST116` --> `DatabaseError` with userMessage "No data found"
- `23xxx` (constraint codes) --> `DatabaseError` with userMessage "Data constraint violation"
- Message contains `JWT` --> `AuthError` with userMessage "Please sign in again"
- All other errors --> generic `DatabaseError`

```typescript
const { data, error } = await supabase.from('events').select('*');
return throwIfSupabaseError({ data, error });
```

#### `requireData<T>(data: T | null | undefined, operation: string): T`

Throws `DatabaseError` if data is null or undefined. Use after insert/update operations where a result row is expected.

- Error message: `Operation '{operation}' returned no data`
- User message: `Failed to {operation}. Please try again.`

```typescript
const { data, error } = await supabase.from('events').insert(event).select().single();
throwIfSupabaseError({ data, error });
return requireData(data, 'create event');
```

#### `fireAndForget(promise: Promise<unknown>, action: string): void`

Executes a promise without awaiting it. Catches errors and logs them via `logError()` (console + Sentry). Use for non-critical side effects like notifications and activity logging.

```typescript
fireAndForget(
  notificationService.queueNewSignup(data),
  'queue new signup notification'
);
```

#### `logError(message: string, error: unknown, extra?: Record<string, unknown>): void`

Logs to `console.error` and sends to `Sentry.captureException`. Use instead of bare `console.error` for errors that should be tracked.

```typescript
logError('Failed to fetch user', error, { userId: '123' });
```

### `errorHandler` Object

| Method | Purpose |
|--------|---------|
| `handle(error, context?, showToast = true)` | Logs error + shows Sonner toast to user |
| `handleAsync<T>(operation, context?, fallbackValue?)` | Wraps async operation with try/catch, calls `handle` on error, returns fallbackValue |
| `fromSupabaseError(error)` | Converts Supabase error to appropriate `AppError` subclass |
| `success(message)` | Shows success toast via Sonner |
| `info(message)` | Shows info toast via Sonner |

---

## 3. Session Validation

Source: `src/lib/sessionValidator.ts`

Two functions for authentication checks:

```typescript
async function validateSession(): Promise<User | null>
```
- Calls `supabase.auth.getSession()`
- If invalid: shows toast, stores `returnUrl` in storage, redirects to `/auth/login`
- Returns `User` or `null`

```typescript
async function requireValidSession(): Promise<User>
```
- Calls `validateSession()`, throws `Error('Session expired')` if null
- Use in service mutation methods

### Usage Pattern

**Mutation methods** (create, update, delete) call `requireValidSession()` before making changes:

```typescript
async createEvent(eventData: CreateEventForm): Promise<Event> {
  await requireValidSession();
  // ... validation and insert
}
```

**Read-only methods** generally do NOT call `requireValidSession()` -- they rely on RLS policies to enforce access control at the database level.

---

## 4. Type Transformation

Services define domain types that extend database types, converting JSONB fields and adding computed properties.

### Pattern

```typescript
import type { Tables } from '@/types/supabase';
import type { CustomField } from '@/lib/validation';

// 1. Define domain type extending DB row type
export type Event = Omit<Tables<'events'>, 'custom_fields'> & {
  custom_fields: CustomField[];
  participant_count?: number;
};

// 2. Converter function
function dbEventToEvent(row: Tables<'events'>): Event {
  return {
    ...row,
    custom_fields: validateCustomFields(row.custom_fields),
  };
}
```

### Examples Across Services

| Service | Domain Type | Transformation |
|---------|-------------|----------------|
| `eventService` | `Event` | `Omit<Tables<'events'>, 'custom_fields'>` + typed `custom_fields: CustomField[]` + optional `participant_count` |
| `participantService` | `Participant` | Extends `Tables<'participants'>` with typed `responses: ResponseRecord` instead of raw `Json` |
| `groupService` | `Group` | Adds computed `event_count` and `participant_count` from RPC calls |

---

## 5. Supabase Query Patterns

### Standard CRUD

```typescript
// SELECT single row
const { data, error } = await supabase
  .from('events')
  .select('*')
  .eq('id', eventId)
  .single();
return throwIfSupabaseError({ data, error });

// INSERT + return result
const { data, error } = await supabase
  .from('events')
  .insert(eventData)
  .select()
  .single();
throwIfSupabaseError({ data, error });
return requireData(data, 'create event');

// UPDATE + return result
const { data, error } = await supabase
  .from('events')
  .update(updates)
  .eq('id', eventId)
  .select()
  .single();

// DELETE
const { data, error } = await supabase
  .from('events')
  .delete()
  .eq('id', eventId);
throwIfSupabaseError({ data, error });
```

### JOINs

```typescript
// LEFT JOIN (nullable relation)
const { data, error } = await supabase
  .from('participants')
  .select('*, labels:participant_labels!left(label:labels!inner(*))')
  .eq('event_id', eventId);

// INNER JOIN
const { data, error } = await supabase
  .from('events')
  .select('*, organizers!inner(name)')
  .eq('id', eventId);
```

### Count Only

```typescript
const { count, error } = await supabase
  .from('participants')
  .select('id', { count: 'exact', head: true })
  .eq('event_id', eventId);
```

### RPC Calls

```typescript
const { data, error } = await supabase.rpc('get_groups_with_counts', {
  p_organizer_id: organizerId,
});
const groups = throwIfSupabaseError({ data, error });
```

### Duplicate Key Handling (code `23505`)

```typescript
const { error } = await supabase.from('group_participants').insert(data);
if (error) {
  if (error.code !== '23505') {
    throwIfSupabaseError({ data: null, error });
  }
  // Silently ignore duplicate key
}
```

### Race Condition Handling (upsert pattern)

Used in `notificationPreferenceService` when two requests may try to create the same row:

```typescript
const { data, error } = await supabase
  .from('notification_preferences')
  .insert({ user_id: user.id, ...DEFAULT_PREFERENCES })
  .select()
  .single();

if (error?.code === '23505') {
  // Another request already created it, fetch the existing row
  const existing = await this.getPreferences();
  if (existing) return existing;
}
throwIfSupabaseError({ data, error });
```

### PGRST116 Handling (No Rows with `.single()`)

When using `.single()` and zero rows is an acceptable outcome:

```typescript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', id)
  .single();
if (error && error.code !== 'PGRST116') throw error;
return data;  // null if no rows found
```

### Real-Time Subscriptions

```typescript
const channel = supabase
  .channel('notifications')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_user_id=eq.${userId}`,
    },
    (payload) => { /* handle new notification */ }
  )
  .subscribe();

// Cleanup
return () => { supabase.removeChannel(channel); };
```

---

## 6. Validation

Source: `src/lib/validation.ts`

### Zod Schemas

| Schema | Purpose |
|--------|---------|
| `eventSchema` | Full event validation with date range refinement |
| `participantSchema` | Participant with email/phone format validation |
| `labelSchema` | Label name 1-50 chars, color format |
| `organizerSchema` | Organizer profile |
| `customFieldSchema` | Custom form field definition |
| `responseValueSchema` | Response value (string, number, or string[]) |
| `responseRecordSchema` | `Record<string, responseValue>` |
| `createEventFormSchema` | `eventSchema` without id, created_at, participant_count |
| `updateEventFormSchema` | Partial `createEvent` + required id |
| `createParticipantFormSchema` | `participantSchema` without id, created_at |
| `updateParticipantFormSchema` | Partial `createParticipant` + required id |
| `profileFormSchema` | fullName + email |
| `groupFormSchema` | name 1-200, description max 2000 |
| `loginFormSchema` | email + password |
| `registerFormSchema` | fullName + email + password (min 6) |
| `newEventFormSchema` | UI form schema with TBD booleans |

### Validation Functions

**Throwing variants** -- throw `ZodError` on invalid input:
- `validateEvent(data)`
- `validateParticipant(data)`
- `validateLabel(data)`
- `validateOrganizer(data)`

**Safe variants** -- return `SafeParseResult` (no throw):
- `safeValidateEvent(data)`
- `safeValidateParticipant(data)`
- `safeValidateLabel(data)`
- `safeValidateOrganizer(data)`

**Special validators:**
- `validateCustomFields(fields: unknown): CustomField[]` -- parses JSONB, returns array of valid fields, silently discards invalid entries
- `validateResponses(responses, customFields): ResponseRecord` -- validates response values against their field definitions

---

## 7. Fire-and-Forget Pattern

Non-critical side effects (notifications, activity logging) are executed without blocking the main operation.

```typescript
// In participantService.createParticipant(), after successful insert:
fireAndForget(
  participantActivityService.logJoined({
    participantId: participant.id,
    eventId: participant.event_id,
    participantName: participant.name,
    slotNumber: participant.slot_number,
    claimedByUserId: participant.claimed_by_user_id,
  }),
  'log participant joined activity'
);
```

Key points:
- `fireAndForget()` catches errors internally and logs them via `logError()` (console + Sentry)
- The calling function does NOT await the result
- Failures in side effects never block or fail the primary user action
- Common uses: queuing notifications, logging participant activity

---

## 8. Service Reference

| Service | Key Methods | Patterns Used |
|---------|-------------|---------------|
| `eventService` | `getEvent`, `getEvents`, `createEvent`, `updateEvent`, `deleteEvent`, `duplicateEvent` | CRUD, type transform (`dbEventToEvent`), session validation, count query |
| `participantService` | `getParticipants`, `createParticipant`, `updateParticipant`, `deleteParticipant`, `exportToCSV` | CRUD, fire-and-forget (notifications + activity), batch operations |
| `labelService` | `getLabels`, `createLabel`, `updateLabel`, `deleteLabel`, `addLabelToParticipant`, `removeLabelFromParticipant` | CRUD, fire-and-forget activity logging |
| `organizerService` | `getOrganizer`, `updateOrganizer` | Simple CRUD |
| `groupService` | `getGroups`, `getGroup`, `createGroup`, `updateGroup`, `deleteGroup`, `getGroupMembers`, `addParticipantsToGroup`, `removeParticipantsFromGroup`, `addUserToGroup`, `leaveGroup`, `getGroupsByUser` | RPC calls, duplicate key handling (`23505`), session validation |
| `featureFlagService` | `fetchFeatureFlags`, `isFeatureEnabled`, `invalidateCache` | In-memory cache (5min TTL), user/group override resolution |
| `notificationService` | `getNotifications`, `markAsRead`, `markAllAsRead`, `deleteNotification`, `queueNewSignup`, `queueWithdrawal`, `queuePaymentReceived`, `queueSignupConfirmed` | RPC (`queue_notification`), real-time subscriptions |
| `pushSubscriptionService` | `saveSubscription`, `removeSubscriptionFromDatabase`, `getActiveSubscriptions` | RPC (`upsert_push_subscription`), browser Push API integration |
| `notificationPreferenceService` | `getPreferences`, `getOrCreatePreferences`, `updatePreferences`, `toggleNotificationType`, `enableAll`, `disableAll` | PGRST116 handling, race condition handling (`23505` upsert), session validation |
| `participantActivityService` | `getEventActivity`, `getParticipantActivity`, `logJoined`, `logWithdrew`, `logPaymentUpdated`, `logInfoUpdated`, `logLabelAdded`, `logLabelRemoved` | `logError` (does not throw on failure), shared `insertActivity` helper |

---

## 9. How to Add a New Service

Complete template:

```typescript
// src/services/myNewService.ts
import { supabase } from '@/lib/supabase';
import { throwIfSupabaseError, requireData, fireAndForget } from '@/lib/errorHandler';
import { requireValidSession } from '@/lib/sessionValidator';
import type { Tables } from '@/types/supabase';

// 1. Define domain type (extend DB type if JSONB fields need typing)
export type MyEntity = Tables<'my_table'>;

// 2. Optional: DB-to-domain converter for JSONB fields
function dbRowToEntity(row: Tables<'my_table'>): MyEntity {
  return { ...row };
}

// 3. Service object with async methods
export const myNewService = {
  async getById(id: string): Promise<MyEntity> {
    const { data, error } = await supabase
      .from('my_table')
      .select('*')
      .eq('id', id)
      .single();
    const result = throwIfSupabaseError({ data, error });
    return requireData(result, 'get entity');
  },

  async create(input: Partial<MyEntity>): Promise<MyEntity> {
    await requireValidSession();
    const { data, error } = await supabase
      .from('my_table')
      .insert(input)
      .select()
      .single();
    throwIfSupabaseError({ data, error });
    return requireData(data, 'create entity');
  },

  async update(id: string, updates: Partial<MyEntity>): Promise<MyEntity> {
    await requireValidSession();
    const { data, error } = await supabase
      .from('my_table')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    throwIfSupabaseError({ data, error });
    return requireData(data, 'update entity');
  },

  async delete(id: string): Promise<void> {
    await requireValidSession();
    const { error } = await supabase
      .from('my_table')
      .delete()
      .eq('id', id);
    throwIfSupabaseError({ data: null, error });
  },
};
```

Then add the export to `src/services/index.ts`:

```typescript
export { myNewService } from './myNewService';
export type { MyEntity } from './myNewService';
```
