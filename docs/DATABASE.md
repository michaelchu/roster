# Database Schema Reference

Detailed schema reference for the Roster application's Supabase PostgreSQL database. For high-level architecture and notification pipeline overview, see `CLAUDE.md`.

---

## 1. Schema Overview

```
                         ┌──────────────┐
                         │  auth.users  │
                         └──────┬───────┘
                                │ id (UUID)
          ┌─────────────────────┼─────────────────────────────────┐
          │                     │                                 │
          ▼                     ▼                                 ▼
   ┌─────────────┐      ┌─────────────┐                ┌──────────────────────┐
   │  organizers  │      │   groups    │                │  push_subscriptions  │
   │  (1:1 user)  │      │             │                └──────────────────────┘
   └─────────────┘      └──────┬──────┘
          │                    │
          │               ┌────┴────────────────┐
          │               │                     │
          │               ▼                     ▼
          │      ┌──────────────────┐  ┌──────────────┐
          │      │group_participants│  │ group_admins  │
          │      └──────────────────┘  └──────────────┘
          │
          ▼
   ┌─────────────┐     ┌──────────────┐     ┌───────────────────┐
   │   events     │────▶│ participants │────▶│ participant_labels │
   └──────┬──────┘     └──────┬───────┘     └────────┬──────────┘
          │                   │                      │
          │                   │                      ▼
          │                   │              ┌──────────────┐
          │                   │              │    labels     │
          │                   │              └──────────────┘
          │                   ▼
          │      ┌───────────────────────────┐
          │      │ participant_activity_log  │
          │      └───────────────────────────┘
          │
          ├──────────────────────────────────┐
          ▼                                  ▼
   ┌───────────────┐              ┌──────────────────┐
   │ notifications │              │notification_queue│
   └───────────────┘              └──────────────────┘

   ┌────────────────┐    ┌──────────────────────────┐
   │ feature_flags  │───▶│ feature_flag_overrides    │
   └────────────────┘    └──────────────────────────┘

   ┌────────────────────────────┐
   │ notification_preferences   │  (1:1 with auth.users)
   └────────────────────────────┘
```

**Key relationships:**
- `organizers` is 1:1 with `auth.users` (PK = user ID)
- `events` belong to an organizer; optionally linked to a `group` and a `parent_event`
- `participants` belong to an `event`; optionally linked to `auth.users` via `user_id` or `claimed_by_user_id`
- `labels` are scoped to an event; applied to participants via `participant_labels`
- `notification_queue` has NO RLS (service role only); `notifications` (inbox) is user-scoped
- `feature_flag_overrides` target either a `user_id` or a `group_id`, never both

---

## 2. Core Tables

### organizers

User profile table. Created automatically via database trigger on auth signup.

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `auth.uid()` | NOT NULL | PK, FK to `auth.users(id)` ON DELETE CASCADE |
| `name` | TEXT | — | YES | max 100 chars |
| `created_at` | TIMESTAMPTZ | `now()` | NOT NULL | — |

**RLS Policies:**

| Operation | Policy Name | Condition |
|-----------|------------|-----------|
| SELECT | Users can view own organizer profile | `id = auth.uid()` |
| INSERT | Users can create own organizer profile | `id = auth.uid()` |
| UPDATE | Users can update own organizer profile | `id = auth.uid()` |

---

### events

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | TEXT | `nanoid()` | NOT NULL | PK (NANOID 8-12 chars) |
| `organizer_id` | UUID | — | NOT NULL | FK to `auth.users(id)` ON DELETE CASCADE |
| `name` | TEXT | — | NOT NULL | 1-200 chars, must contain non-whitespace |
| `description` | TEXT | — | YES | max 2000 chars |
| `datetime` | TIMESTAMPTZ | — | YES | allows TBD events |
| `end_datetime` | TIMESTAMPTZ | — | YES | must be after `datetime` when both are set |
| `location` | TEXT | — | YES | max 500 chars |
| `is_private` | BOOLEAN | `false` | NOT NULL | — |
| `custom_fields` | JSONB | `'[]'::jsonb` | — | array of custom field objects |
| `max_participants` | INTEGER | — | YES | 1-100 when set |
| `group_id` | TEXT | — | YES | FK to `groups(id)` ON DELETE SET NULL |
| `parent_event_id` | TEXT | — | YES | FK to `events(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | `now()` | NOT NULL | — |

**Indexes:**

| Index | Column(s) |
|-------|-----------|
| `idx_events_organizer_id` | `organizer_id` |
| `idx_events_group_id` | `group_id` |
| `idx_events_parent_event_id` | `parent_event_id` |
| `idx_events_datetime` | `datetime` |
| `idx_events_created_at` | `created_at` |

**RLS Policies:**

| Operation | Policy Name | Condition |
|-----------|------------|-----------|
| SELECT | (public view) | `is_private = false` OR `organizer_id = auth.uid()` |
| INSERT | Authenticated users can create events | `organizer_id = auth.uid()` |
| UPDATE | Organizers can update their own events | `organizer_id = auth.uid()` |
| DELETE | Organizers can delete their own events | `organizer_id = auth.uid()` |

**Triggers:**

| Trigger | Timing | Event | Function |
|---------|--------|-------|----------|
| `check_capacity_reduction_trigger` | BEFORE UPDATE | `max_participants` column | `check_capacity_reduction()` — prevents reducing below current participant count |
| `trigger_event_updated` | AFTER UPDATE | `name`, `description`, `datetime`, `end_datetime`, `location` columns | `notify_on_event_updated()` — queues `event_updated` notifications |
| `trigger_event_deleted` | BEFORE DELETE | row deletion | `notify_on_event_deleted()` — queues `event_cancelled` notifications |

---

### participants

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `event_id` | TEXT | — | NOT NULL | FK to `events(id)` ON DELETE CASCADE |
| `name` | TEXT | — | NOT NULL | 1-100 chars |
| `email` | TEXT | — | YES | max 254 chars, email format validation |
| `phone` | TEXT | — | YES | max 20 chars, phone format validation |
| `notes` | TEXT | — | YES | max 1000 chars |
| `user_id` | UUID | — | YES | FK to `auth.users(id)` ON DELETE SET NULL |
| `claimed_by_user_id` | UUID | — | YES | FK to `auth.users(id)` — for claimed spots |
| `slot_number` | INTEGER | — | NOT NULL | auto-assigned by trigger |
| `responses` | JSONB | `'{}'::jsonb` | — | custom field responses |
| `payment_status` | TEXT | `'pending'` | — | CHECK: `'pending'`, `'paid'`, `'waived'` |
| `payment_marked_at` | TIMESTAMPTZ | — | YES | — |
| `payment_notes` | TEXT | — | YES | max 500 chars |
| `created_at` | TIMESTAMPTZ | `now()` | NOT NULL | — |

**Unique Constraints:**

| Constraint | Columns |
|-----------|---------|
| (unnamed) | `(event_id, slot_number)` |

**Indexes:**

| Index | Column(s) |
|-------|-----------|
| `idx_participants_event_id` | `event_id` |
| `idx_participants_user_id` | `user_id` |
| `idx_participants_claimed_by_user` | `claimed_by_user_id` |
| `idx_participants_email` | `email` |
| `idx_participants_slot_number` | `slot_number` |
| `idx_participants_created_at` | `created_at` |
| `idx_participants_payment_status` | `payment_status` |

**RLS Policies:**

| Operation | Policy Name | Condition |
|-----------|------------|-----------|
| SELECT | (public view) | event `is_private = false` OR event `organizer_id = auth.uid()` |
| INSERT | Anyone can register for public events | event is public |
| INSERT | Authenticated users can claim spots for others | `claimed_by_user_id = auth.uid()` |
| UPDATE | Organizers can update participants in their events | event organizer = `auth.uid()` |
| DELETE | Organizers can delete participants from their events | event organizer = `auth.uid()` |

**Triggers:**

| Trigger | Timing | Event | Function |
|---------|--------|-------|----------|
| `a_check_event_capacity_trigger` | BEFORE INSERT | row | `check_event_capacity()` — enforces `max_participants` limit |
| `assign_participant_slot_trigger` | BEFORE INSERT | row | `assign_participant_slot()` — assigns sequential slot numbers |
| `auto_add_participant_to_group_trigger` | AFTER INSERT | row | `auto_add_participant_to_group()` — adds user to event's group |
| `trigger_participant_created` | AFTER INSERT | row | `notify_on_participant_created()` — queues `new_signup`, `signup_confirmed`, `capacity_reached` |
| `auto_remove_participant_from_group_trigger` | AFTER DELETE | row | `auto_remove_participant_from_group()` — removes from group |
| `compact_slots_after_participant_deletion` | AFTER DELETE | row | `compact_slots_after_deletion()` — recompacts slot numbers |
| `trigger_participant_deleted` | AFTER DELETE | row | `notify_on_participant_deleted()` — queues `withdrawal` notification |
| `trigger_payment_changed` | AFTER UPDATE | `payment_status` column | `notify_on_payment_changed()` — queues `payment_received` |

Note: Trigger `a_check_event_capacity_trigger` is prefixed with `a_` to ensure it fires before `assign_participant_slot_trigger` (alphabetical ordering).

---

### labels

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `event_id` | TEXT | — | NOT NULL | FK to `events(id)` ON DELETE CASCADE |
| `name` | TEXT | — | NOT NULL | 1-50 chars |
| `color` | TEXT | `'#gray'` | — | hex or named color |

**RLS:** Organizers can manage (SELECT/INSERT/UPDATE/DELETE) labels for their own events (event `organizer_id = auth.uid()`).

---

### participant_labels

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `participant_id` | UUID | — | NOT NULL | FK to `participants(id)` ON DELETE CASCADE |
| `label_id` | UUID | — | NOT NULL | FK to `labels(id)` ON DELETE CASCADE |
| `created_at` | TIMESTAMPTZ | `now()` | NOT NULL | — |

**Unique Constraints:**

| Constraint | Columns |
|-----------|---------|
| (unnamed) | `(participant_id, label_id)` |

**RLS:** Organizers can manage participant labels for their own events (resolved through participant -> event -> organizer chain).

---

## 3. Group Tables

### groups

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | TEXT | `nanoid()` | NOT NULL | PK (NANOID 8-12 chars) |
| `organizer_id` | UUID | — | NOT NULL | FK to `auth.users(id)` ON DELETE CASCADE |
| `name` | TEXT | — | NOT NULL | 1-200 chars, must contain non-whitespace |
| `description` | TEXT | — | YES | max 2000 chars |
| `created_at` | TIMESTAMPTZ | `now()` | NOT NULL | — |

**Indexes:**

| Index | Column(s) |
|-------|-----------|
| `idx_groups_organizer_id` | `organizer_id` |
| `idx_groups_created_at` | `created_at` |

**RLS:** Users can SELECT/INSERT/UPDATE/DELETE their own groups (`organizer_id = auth.uid()`).

---

### group_participants

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `group_id` | TEXT | — | NOT NULL | FK to `groups(id)` ON DELETE CASCADE |
| `user_id` | UUID | — | YES | FK to `auth.users(id)` |
| `joined_at` | TIMESTAMPTZ | `now()` | NOT NULL | — |

**Unique Constraints:**

| Constraint | Columns |
|-----------|---------|
| (unnamed) | `(group_id, user_id)` |

**RLS:** Organizers (group owner) and group admins can manage participants.

---

### group_admins

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `group_id` | TEXT | — | NOT NULL | FK to `groups(id)` ON DELETE CASCADE |
| `user_id` | UUID | — | NOT NULL | FK to `auth.users(id)` ON DELETE CASCADE |
| `created_at` | TIMESTAMPTZ | `now()` | NOT NULL | — |

**Unique Constraints:**

| Constraint | Columns |
|-----------|---------|
| (unnamed) | `(group_id, user_id)` |

**RLS:** Group owners can manage admins; users can view their own admin status.

---

## 4. Notification Tables

### notifications

In-app notification inbox. Populated by the `send-push` edge function after processing the queue.

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `recipient_user_id` | UUID | — | NOT NULL | FK to `auth.users(id)` ON DELETE CASCADE |
| `type` | TEXT | — | NOT NULL | notification type string |
| `title` | TEXT | — | NOT NULL | — |
| `body` | TEXT | — | NOT NULL | — |
| `event_id` | TEXT | — | YES | FK to `events(id)` ON DELETE SET NULL |
| `participant_id` | UUID | — | YES | FK to `participants(id)` ON DELETE SET NULL |
| `actor_user_id` | UUID | — | YES | FK to `auth.users(id)` ON DELETE SET NULL |
| `action_url` | TEXT | — | YES | — |
| `read_at` | TIMESTAMPTZ | — | YES | set when user reads notification |
| `created_at` | TIMESTAMPTZ | `NOW()` | — | — |

**Indexes:**

| Index | Column(s) |
|-------|-----------|
| `idx_notifications_recipient_created` | `recipient_user_id`, `created_at` |
| `idx_notifications_unread` | `recipient_user_id` WHERE `read_at IS NULL` |
| `idx_notifications_event` | `event_id` |

**RLS Policies:**

| Operation | Condition |
|-----------|-----------|
| SELECT | `recipient_user_id = auth.uid()` |
| INSERT | `recipient_user_id = auth.uid()` |
| UPDATE | `recipient_user_id = auth.uid()` |
| DELETE | `recipient_user_id = auth.uid()` |

---

### notification_queue

Processing queue for outbound notifications. No RLS -- accessed only by service role and edge functions.

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `recipient_user_id` | UUID | — | NOT NULL | FK to `auth.users(id)` |
| `notification_type` | TEXT | — | NOT NULL | — |
| `title` | TEXT | — | NOT NULL | — |
| `body` | TEXT | — | NOT NULL | — |
| `event_id` | TEXT | — | YES | — |
| `participant_id` | UUID | — | YES | — |
| `actor_user_id` | UUID | — | YES | — |
| `action_url` | TEXT | — | YES | — |
| `scheduled_for` | TIMESTAMPTZ | `NOW()` | — | — |
| `status` | TEXT | `'pending'` | — | CHECK: `'pending'`, `'processing'`, `'sent'`, `'failed'`, `'skipped'` |
| `attempts` | INTEGER | `0` | — | — |
| `last_error` | TEXT | — | YES | — |
| `created_at` | TIMESTAMPTZ | `NOW()` | — | — |
| `processed_at` | TIMESTAMPTZ | — | YES | — |
| `updated_at` | TIMESTAMPTZ | `NOW()` | — | — |

**Indexes:**

| Index | Column(s) |
|-------|-----------|
| `idx_notification_queue_pending` | `status`, `scheduled_for` WHERE `status = 'pending'` |
| `idx_notification_queue_recipient` | `recipient_user_id` |
| `idx_notification_queue_event` | `event_id` |

**RLS:** NONE. Service role access only.

**Triggers:**

| Trigger | Timing | Event | Function |
|---------|--------|-------|----------|
| `trigger_notification_queue_send_push` | AFTER INSERT | FOR EACH STATEMENT | `trigger_send_push()` — invokes `send-push` edge function via `pg_net` |
| `update_notification_queue_updated_at` | BEFORE UPDATE | row | `update_updated_at_column()` — auto-updates `updated_at` |

---

### notification_preferences

Per-user notification preference toggles. One row per user.

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `user_id` | UUID | — | NOT NULL | FK to `auth.users(id)` ON DELETE CASCADE, UNIQUE |
| `push_enabled` | BOOLEAN | `true` | — | master toggle |
| `notify_new_signup` | BOOLEAN | `true` | — | — |
| `notify_withdrawal` | BOOLEAN | `true` | — | — |
| `notify_payment_received` | BOOLEAN | `true` | — | — |
| `notify_capacity_reached` | BOOLEAN | `true` | — | — |
| `notify_signup_confirmed` | BOOLEAN | `true` | — | — |
| `notify_event_updated` | BOOLEAN | `true` | — | — |
| `notify_event_cancelled` | BOOLEAN | `true` | — | — |
| `notify_payment_reminder` | BOOLEAN | `true` | — | — |
| `notify_waitlist_promotion` | BOOLEAN | `true` | — | — |
| `created_at` | TIMESTAMPTZ | — | — | — |
| `updated_at` | TIMESTAMPTZ | — | — | — |

**RLS:** Users can SELECT/INSERT/UPDATE their own preferences (`user_id = auth.uid()`).

---

### push_subscriptions

Web Push API subscription records. One per device per user.

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `user_id` | UUID | — | NOT NULL | FK to `auth.users(id)` ON DELETE CASCADE |
| `endpoint` | TEXT | — | NOT NULL | UNIQUE |
| `p256dh_key` | TEXT | — | NOT NULL | — |
| `auth_key` | TEXT | — | NOT NULL | — |
| `user_agent` | TEXT | — | YES | — |
| `active` | BOOLEAN | `true` | — | — |
| `created_at` | TIMESTAMPTZ | — | — | — |
| `last_used_at` | TIMESTAMPTZ | — | — | — |

**RLS:** Users can SELECT/INSERT/UPDATE/DELETE their own subscriptions (`user_id = auth.uid()`).

---

## 5. Support Tables

### feature_flags

Platform-wide feature flag definitions.

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `key` | TEXT | — | NOT NULL | UNIQUE |
| `enabled` | BOOLEAN | `false` | NOT NULL | — |
| `description` | TEXT | — | YES | — |
| `created_at` | TIMESTAMPTZ | — | — | — |
| `updated_at` | TIMESTAMPTZ | — | — | — |

**RLS:** Any user (authenticated or anonymous) can SELECT. Only service role can INSERT/UPDATE/DELETE.

**Triggers:**

| Trigger | Timing | Event | Function |
|---------|--------|-------|----------|
| `update_feature_flags_updated_at` | BEFORE UPDATE | row | `update_updated_at_column()` |

---

### feature_flag_overrides

User-level or group-level overrides for feature flags.

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `feature_flag_key` | TEXT | — | NOT NULL | — |
| `user_id` | UUID | — | YES | FK to `auth.users(id)` ON DELETE CASCADE |
| `group_id` | TEXT | — | YES | FK to `groups(id)` ON DELETE CASCADE |
| `enabled` | BOOLEAN | — | NOT NULL | — |
| `created_at` | TIMESTAMPTZ | — | — | — |
| `updated_at` | TIMESTAMPTZ | — | — | — |

**CHECK Constraints:**
- Exactly one of `user_id` or `group_id` must be set (not both, not neither)

**Unique Constraints:**

| Constraint | Columns |
|-----------|---------|
| (unnamed) | `(feature_flag_key, user_id)` |
| (unnamed) | `(feature_flag_key, group_id)` |

**RLS Policies:**
- Users can read overrides where `user_id = auth.uid()`
- Users can read group overrides for groups they belong to (via `group_participants`)

---

### participant_activity_log

Immutable audit log of participant-related actions within events.

| Column | Type | Default | Nullable | Constraints |
|--------|------|---------|----------|-------------|
| `id` | UUID | `gen_random_uuid()` | NOT NULL | PK |
| `participant_id` | UUID | — | YES | FK to `participants(id)` ON DELETE SET NULL |
| `event_id` | TEXT | — | NOT NULL | FK to `events(id)` ON DELETE CASCADE |
| `activity_type` | TEXT | — | NOT NULL | CHECK: `'joined'`, `'withdrew'`, `'payment_updated'`, `'info_updated'`, `'label_added'`, `'label_removed'` |
| `participant_name` | TEXT | — | NOT NULL | snapshot of name at time of activity |
| `details` | JSONB | `'{}'` | — | activity-specific payload |
| `created_at` | TIMESTAMPTZ | `NOW()` | NOT NULL | — |

**Indexes:**

| Index | Column(s) |
|-------|-----------|
| `idx_participant_activity_event` | `event_id` |
| `idx_participant_activity_participant` | `participant_id` |
| `idx_participant_activity_type` | `activity_type` |

**RLS Policies:**

| Operation | Condition |
|-----------|-----------|
| SELECT | Organizers can view activity for events they own |
| INSERT | Authenticated users can insert |

**`details` JSONB shapes by `activity_type`:**

**`joined`:**
```json
{
  "slot_number": 3,
  "claimed_by_user_id": "uuid-string-or-null"
}
```

**`withdrew`:**
```json
{
  "slot_number": 3,
  "payment_status": "pending"
}
```

**`payment_updated`:**
```json
{
  "from": "pending",
  "to": "paid"
}
```

**`info_updated`:**
```json
{
  "name": { "from": "Old Name", "to": "New Name" },
  "email": { "from": "old@example.com", "to": "new@example.com" },
  "phone": { "from": "1234567890", "to": "0987654321" },
  "notes": { "from": "old notes", "to": "new notes" }
}
```
Only changed fields are included.

**`label_added`:**
```json
{
  "label_id": "uuid-string",
  "label_name": "VIP"
}
```

**`label_removed`:**
```json
{
  "label_id": "uuid-string",
  "label_name": "VIP"
}
```

---

## 6. Database Functions (RPC)

### ID Generation

| Function | Signature | Notes |
|----------|-----------|-------|
| `nanoid` | `(size INTEGER DEFAULT 10) RETURNS TEXT` | Generates NANOID string; used as default for `events.id` and `groups.id` |

### Slot Management

| Function | Signature | Notes |
|----------|-----------|-------|
| `get_next_slot_number` | `(p_event_id TEXT, p_user_id UUID DEFAULT NULL) RETURNS INTEGER` | Returns next available slot number for an event |

### Notification

| Function | Signature | Notes |
|----------|-----------|-------|
| `queue_notification` | `(p_recipient_user_id UUID, p_notification_type TEXT, p_title TEXT, p_body TEXT, p_event_id TEXT DEFAULT NULL, p_participant_id UUID DEFAULT NULL, p_actor_user_id UUID DEFAULT NULL, p_action_url TEXT DEFAULT NULL)` | **SECURITY DEFINER** — inserts into `notification_queue`, bypasses RLS to allow cross-user notifications |

### Push Subscriptions

| Function | Signature | Notes |
|----------|-----------|-------|
| `upsert_push_subscription` | `(p_user_id UUID, p_endpoint TEXT, p_p256dh_key TEXT, p_auth_key TEXT, p_user_agent TEXT DEFAULT NULL)` | **SECURITY DEFINER** — handles device switching atomically; deactivates existing subscriptions on same endpoint for other users |

### User Profiles

| Function | Signature | Notes |
|----------|-----------|-------|
| `get_user_profile` | `(user_id UUID)` | Returns user profile information |
| `get_user_display_name` | `(user_id UUID) RETURNS TEXT` | Extracts display name from auth metadata |

### Event Queries

| Function | Signature | Notes |
|----------|-----------|-------|
| `get_event_participants_with_avatar` | `(p_event_id TEXT)` | Returns participants with avatar URLs from auth metadata |

### Group Queries

| Function | Signature | Notes |
|----------|-----------|-------|
| `get_groups_with_counts` | `(p_organizer_id TEXT)` | Returns groups with event count and participant count |
| `get_group_by_id_with_counts` | `(p_group_id TEXT)` | Single group with event and participant counts |
| `get_user_groups_with_counts` | `(p_user_id TEXT)` | Groups a user participates in, with counts |
| `get_group_members_with_user_info` | `(p_group_id TEXT)` | Group members with user info and avatar URLs |

### Group Management

| Function | Signature | Notes |
|----------|-----------|-------|
| `add_participants_to_group` | `(p_group_id TEXT, p_participant_ids TEXT[])` | **SECURITY DEFINER** — atomic batch add of participants to a group |
| `remove_participants_from_group` | `(p_group_id TEXT, p_participant_ids TEXT[])` | **SECURITY DEFINER** — atomic batch remove of participants from a group |
| `delete_group_atomic` | `(p_group_id TEXT, p_delete_events BOOLEAN)` | Atomic group deletion; optionally deletes or unlinks associated events |

### Payment

| Function | Signature | Notes |
|----------|-----------|-------|
| `bulk_update_payment_status` | `(p_participant_ids TEXT[], p_payment_status TEXT, p_payment_notes TEXT)` | Batch update payment status for multiple participants |

### Seed Helpers

| Function | Signature | Notes |
|----------|-----------|-------|
| `get_or_create_user` | `(user_email TEXT, user_name TEXT) RETURNS UUID` | Creates or retrieves a user in `auth.users`; used by `seed.sql` |

---

## 7. Trigger Functions

| Function | Table | Timing | Behavior |
|----------|-------|--------|----------|
| `check_event_capacity` | `participants` | BEFORE INSERT | Counts current participants; raises exception if `max_participants` would be exceeded |
| `assign_participant_slot` | `participants` | BEFORE INSERT | Sets `slot_number` to next sequential value for the event |
| `compact_slots_after_deletion` | `participants` | AFTER DELETE | Recompacts slot numbers to fill gaps after a participant is removed |
| `check_capacity_reduction` | `events` | BEFORE UPDATE | Prevents setting `max_participants` below the current participant count |
| `auto_add_participant_to_group` | `participants` | AFTER INSERT | If the event belongs to a group, adds the participant's user to `group_participants` |
| `auto_remove_participant_from_group` | `participants` | AFTER DELETE | If the event belongs to a group, removes the user from `group_participants` (if not in other group events) |
| `notify_on_participant_created` | `participants` | AFTER INSERT | **SECURITY DEFINER** — queues `new_signup` (to organizer), `signup_confirmed` (to participant), and `capacity_reached` (to organizer, if at max) |
| `notify_on_participant_deleted` | `participants` | AFTER DELETE | **SECURITY DEFINER** — queues `withdrawal` notification to organizer |
| `notify_on_event_updated` | `events` | AFTER UPDATE | **SECURITY DEFINER** — queues `event_updated` notification to all participants with user accounts |
| `notify_on_event_deleted` | `events` | BEFORE DELETE | **SECURITY DEFINER** — queues `event_cancelled` notification to all participants before the event row is removed |
| `notify_on_payment_changed` | `participants` | AFTER UPDATE | **SECURITY DEFINER** — queues `payment_received` notification to organizer when `payment_status` changes to `'paid'` |
| `trigger_send_push` | `notification_queue` | AFTER INSERT (STATEMENT) | Invokes the `send-push` edge function via `pg_net` HTTP extension for immediate delivery |
| `update_updated_at_column` | (multiple) | BEFORE UPDATE | Generic trigger that sets `updated_at = NOW()` |

---

## 8. Key Constraints Summary

### Text Length Limits

| Table | Column | Min | Max |
|-------|--------|-----|-----|
| `organizers` | `name` | — | 100 |
| `events` | `name` | 1 | 200 |
| `events` | `description` | — | 2000 |
| `events` | `location` | — | 500 |
| `participants` | `name` | 1 | 100 |
| `participants` | `email` | — | 254 |
| `participants` | `phone` | — | 20 |
| `participants` | `notes` | — | 1000 |
| `participants` | `payment_notes` | — | 500 |
| `labels` | `name` | 1 | 50 |
| `groups` | `name` | 1 | 200 |
| `groups` | `description` | — | 2000 |

### Enum-Like CHECK Values

| Table | Column | Allowed Values |
|-------|--------|----------------|
| `participants` | `payment_status` | `'pending'`, `'paid'`, `'waived'` |
| `notification_queue` | `status` | `'pending'`, `'processing'`, `'sent'`, `'failed'`, `'skipped'` |
| `participant_activity_log` | `activity_type` | `'joined'`, `'withdrew'`, `'payment_updated'`, `'info_updated'`, `'label_added'`, `'label_removed'` |

### Numeric Constraints

| Table | Column | Range |
|-------|--------|-------|
| `events` | `max_participants` | 1-100 (when set) |

### Foreign Key Cascade Behavior

| Parent Table | Child Table | Column | On Delete |
|-------------|-------------|--------|-----------|
| `auth.users` | `organizers` | `id` | CASCADE |
| `auth.users` | `events` | `organizer_id` | CASCADE |
| `auth.users` | `participants` | `user_id` | SET NULL |
| `auth.users` | `group_admins` | `user_id` | CASCADE |
| `auth.users` | `notifications` | `recipient_user_id` | CASCADE |
| `auth.users` | `notifications` | `actor_user_id` | SET NULL |
| `auth.users` | `notification_preferences` | `user_id` | CASCADE |
| `auth.users` | `push_subscriptions` | `user_id` | CASCADE |
| `auth.users` | `feature_flag_overrides` | `user_id` | CASCADE |
| `events` | `participants` | `event_id` | CASCADE |
| `events` | `labels` | `event_id` | CASCADE |
| `events` | `notifications` | `event_id` | SET NULL |
| `events` | `participant_activity_log` | `event_id` | CASCADE |
| `events` | `events` | `parent_event_id` | SET NULL |
| `events` | `events` | `group_id` (on groups) | SET NULL |
| `groups` | `group_participants` | `group_id` | CASCADE |
| `groups` | `group_admins` | `group_id` | CASCADE |
| `groups` | `feature_flag_overrides` | `group_id` | CASCADE |
| `participants` | `participant_labels` | `participant_id` | CASCADE |
| `participants` | `notifications` | `participant_id` | SET NULL |
| `participants` | `participant_activity_log` | `participant_id` | SET NULL |
| `labels` | `participant_labels` | `label_id` | CASCADE |

---

## 9. How to Add a New Table

### Step 1: Create Migration

```bash
npx supabase migration new add_my_table
```

This creates a file in `supabase/migrations/` with a timestamp prefix.

### Step 2: Write the SQL

```sql
-- Create table
CREATE TABLE my_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for frequently queried columns
CREATE INDEX idx_my_table_organizer_id ON my_table(organizer_id);

-- Enable RLS (required for all tables)
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view own records"
  ON my_table FOR SELECT
  USING (organizer_id = auth.uid());

CREATE POLICY "Users can create own records"
  ON my_table FOR INSERT
  WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "Users can update own records"
  ON my_table FOR UPDATE
  USING (organizer_id = auth.uid());

CREATE POLICY "Users can delete own records"
  ON my_table FOR DELETE
  USING (organizer_id = auth.uid());
```

### Step 3: Apply Migration

```bash
npx supabase migration up
```

Do NOT use `npx supabase db reset` (wipes local data) or `npx supabase db push` (CI/CD handles production).

### Step 4: Add TypeScript Types

Add the table types to `src/types/`. Follow the existing pattern -- define a `Row` type matching the database columns and any insert/update partial types needed.

### Step 5: Create Service

Create `src/services/myTableService.ts` following the service layer pattern:

```typescript
import { supabase } from '@/lib/supabase';
import type { MyTable } from '@/types';

export const myTableService = {
  async getAll(organizerId: string): Promise<MyTable[]> {
    const { data, error } = await supabase
      .from('my_table')
      .select('*')
      .eq('organizer_id', organizerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },
  // ... additional CRUD methods
};
```

Export from `src/services/index.ts`.

### Step 6: Update Seed Data (Optional)

If the table needs local dev data, add INSERT statements to `supabase/seed.sql`.
