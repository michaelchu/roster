# Push Notifications Implementation Plan

## Overview

A comprehensive push notification system for Roster PWA that notifies organizers and participants about signup-related events. All notifications are delivered via Web Push and stored in an inbox for future reference.

## Core Requirements

- **Push-only**: No email notifications
- **Platform**: Supabase (Edge Functions + Database)
- **Delivery**: Instant for most events, scheduled for payment reminders (24hr after event)
- **Persistence**: All notifications stored in inbox for history
- **UI**: Toast notifications + Notification Center/Inbox

---

## Notification Event Matrix

### For Organizers (Event Owners)

| Event | Trigger | Priority | Timing |
|-------|---------|----------|--------|
| New Participant Signup | `participant` INSERT | High | Instant |
| Participant Withdrawal | `participant` DELETE | High | Instant |
| Payment Received | `participant.payment_status` → 'paid' | Medium | Instant |
| Event Capacity Reached | `participant` INSERT (when count = max) | Medium | Instant |

### For Participants (Registered Users)

| Event | Trigger | Priority | Timing |
|-------|---------|----------|--------|
| Signup Confirmed | `participant` INSERT (self) | High | Instant |
| Event Details Updated | `event` UPDATE (title, date, location, etc.) | High | Instant |
| Event Cancelled | `event` DELETE or status change | Critical | Instant |
| Payment Reminder | Scheduled job | Medium | 24hr after event |
| Waitlist Promotion | `participant` INSERT from waitlist | High | Instant |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Permission   │  │ Notification │  │ Settings Page            │  │
│  │ Prompt       │  │ Center/Inbox │  │ (Push Preferences)       │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                       │                │
│  ┌──────▼─────────────────▼───────────────────────▼─────────────┐  │
│  │                 Notification Services                        │  │
│  │  • pushSubscriptionService.ts - Subscribe/unsubscribe        │  │
│  │  • notificationPreferenceService.ts - User preferences       │  │
│  │  • notificationService.ts - Fetch inbox, mark read           │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                             │                                      │
└─────────────────────────────┼──────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│                      SERVICE WORKER                                │
│  • Listen for 'push' events                                        │
│  • Display system notifications                                    │
│  • Handle notification clicks → deep link to relevant page         │
│  • Badge management                                                │
└─────────────────────────────┬──────────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────────┐
│                        SUPABASE                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  DATABASE TABLES                                                   │
│  ┌────────────────────┐  ┌────────────────────┐                   │
│  │ push_subscriptions │  │ notification_      │                   │
│  │ • endpoint         │  │ preferences        │                   │
│  │ • p256dh_key       │  │ • push_enabled     │                   │
│  │ • auth_key         │  │ • notify_* flags   │                   │
│  │ • user_id          │  │ • user_id          │                   │
│  └────────────────────┘  └────────────────────┘                   │
│                                                                    │
│  ┌────────────────────┐  ┌────────────────────┐                   │
│  │ notifications      │  │ notification_queue │                   │
│  │ (inbox/history)    │  │ (pending sends)    │                   │
│  │ • title, body      │  │ • payload          │                   │
│  │ • type, read_at    │  │ • status           │                   │
│  │ • event_id         │  │ • scheduled_for    │                   │
│  └────────────────────┘  └────────────────────┘                   │
│                                                                    │
│  DATABASE TRIGGERS                                                 │
│  • on_participant_created → queue organizer + participant notifs  │
│  • on_participant_deleted → queue organizer notification          │
│  • on_event_updated → queue all participant notifications         │
│  • on_payment_status_changed → queue organizer notification       │
│                                                                    │
│  EDGE FUNCTIONS                                                    │
│  ┌────────────────────┐  ┌────────────────────┐                   │
│  │ send-push          │  │ process-scheduled  │                   │
│  │ • Web Push API     │  │ • Cron: hourly     │                   │
│  │ • VAPID signing    │  │ • Payment reminders│                   │
│  │ • Retry logic      │  │                    │                   │
│  └────────────────────┘  └────────────────────┘                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Table: `notification_preferences`

Stores user preferences for which notifications they want to receive.

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Master toggle
  push_enabled BOOLEAN DEFAULT true,

  -- Organizer notification preferences
  notify_new_signup BOOLEAN DEFAULT true,
  notify_withdrawal BOOLEAN DEFAULT true,
  notify_payment_received BOOLEAN DEFAULT true,
  notify_capacity_reached BOOLEAN DEFAULT true,

  -- Participant notification preferences
  notify_signup_confirmed BOOLEAN DEFAULT true,
  notify_event_updated BOOLEAN DEFAULT true,
  notify_event_cancelled BOOLEAN DEFAULT true,
  notify_payment_reminder BOOLEAN DEFAULT true,
  notify_waitlist_promotion BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_preferences UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);
```

### Table: `push_subscriptions`

Stores Web Push subscription data for each user device.

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Web Push API subscription object fields
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,

  -- Device metadata
  user_agent TEXT,

  -- State
  active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_endpoint UNIQUE(endpoint)
);

-- Index for quick lookups
CREATE INDEX idx_push_subscriptions_user_active
  ON push_subscriptions(user_id)
  WHERE active = true;

-- RLS Policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
```

### Table: `notifications`

The notification inbox - stores all sent notifications for history.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification content
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Related entities (for deep linking)
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  participant_id TEXT REFERENCES participants(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- who triggered this

  -- Deep link URL path
  action_url TEXT,

  -- State
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_recipient_created
  ON notifications(recipient_user_id, created_at DESC);

CREATE INDEX idx_notifications_unread
  ON notifications(recipient_user_id)
  WHERE read_at IS NULL;

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Users can update own notifications (mark read)"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_user_id);
```

### Table: `notification_queue`

Queue for pending notification deliveries.

```sql
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Target
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Content
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Related entities
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  participant_id TEXT REFERENCES participants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_url TEXT,

  -- Scheduling
  scheduled_for TIMESTAMPTZ DEFAULT NOW(), -- For delayed notifications

  -- Processing state
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts INT DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Index for processing
CREATE INDEX idx_notification_queue_pending
  ON notification_queue(scheduled_for)
  WHERE status = 'pending';

-- RLS: Only edge functions access this (service role)
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
-- No user policies - only service role can access
```

### Notification Types Enum

```sql
-- Reference for notification types
COMMENT ON TABLE notifications IS 'Notification types:
- new_signup: Organizer receives when someone signs up
- withdrawal: Organizer receives when someone withdraws
- payment_received: Organizer receives when payment confirmed
- capacity_reached: Organizer receives when event is full
- signup_confirmed: Participant receives signup confirmation
- event_updated: Participant receives when event details change
- event_cancelled: Participant receives when event is cancelled
- payment_reminder: Participant receives 24hr after event if unpaid
- waitlist_promotion: Participant receives when promoted from waitlist
';
```

---

## Database Triggers

### Trigger: On Participant Created

```sql
CREATE OR REPLACE FUNCTION notify_on_participant_created()
RETURNS TRIGGER AS $$
DECLARE
  v_event RECORD;
  v_organizer_id UUID;
  v_participant_name TEXT;
  v_participant_user_id UUID;
BEGIN
  -- Get event details and organizer
  SELECT e.*, o.user_id INTO v_event, v_organizer_id
  FROM events e
  JOIN organizers o ON e.organizer_id = o.id
  WHERE e.id = NEW.event_id;

  v_participant_name := NEW.name;
  v_participant_user_id := COALESCE(NEW.user_id, NEW.claimed_by_user_id);

  -- 1. Notify organizer of new signup
  INSERT INTO notification_queue (
    recipient_user_id,
    notification_type,
    title,
    body,
    event_id,
    participant_id,
    actor_user_id,
    action_url
  ) VALUES (
    v_organizer_id,
    'new_signup',
    'New signup for ' || v_event.title,
    v_participant_name || ' just signed up',
    NEW.event_id,
    NEW.id,
    v_participant_user_id,
    '/events/' || NEW.event_id || '/participants'
  );

  -- 2. Notify participant of confirmation (if they have a user account)
  IF v_participant_user_id IS NOT NULL THEN
    INSERT INTO notification_queue (
      recipient_user_id,
      notification_type,
      title,
      body,
      event_id,
      participant_id,
      action_url
    ) VALUES (
      v_participant_user_id,
      'signup_confirmed',
      'Signup confirmed!',
      'You''re registered for ' || v_event.title,
      NEW.event_id,
      NEW.id,
      '/events/' || NEW.event_id
    );
  END IF;

  -- 3. Check if capacity reached (and notify organizer)
  PERFORM check_and_notify_capacity_reached(NEW.event_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_participant_created
  AFTER INSERT ON participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_participant_created();
```

### Trigger: On Participant Deleted

```sql
CREATE OR REPLACE FUNCTION notify_on_participant_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_event RECORD;
  v_organizer_id UUID;
BEGIN
  -- Get event details and organizer
  SELECT e.*, o.user_id INTO v_event, v_organizer_id
  FROM events e
  JOIN organizers o ON e.organizer_id = o.id
  WHERE e.id = OLD.event_id;

  -- Notify organizer of withdrawal
  INSERT INTO notification_queue (
    recipient_user_id,
    notification_type,
    title,
    body,
    event_id,
    action_url
  ) VALUES (
    v_organizer_id,
    'withdrawal',
    'Withdrawal from ' || v_event.title,
    OLD.name || ' has withdrawn',
    OLD.event_id,
    '/events/' || OLD.event_id || '/participants'
  );

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_participant_deleted
  AFTER DELETE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_participant_deleted();
```

### Trigger: On Event Updated

```sql
CREATE OR REPLACE FUNCTION notify_on_event_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_participant RECORD;
  v_changes TEXT[];
BEGIN
  -- Only notify for significant changes
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    v_changes := array_append(v_changes, 'title');
  END IF;
  IF OLD.date IS DISTINCT FROM NEW.date THEN
    v_changes := array_append(v_changes, 'date');
  END IF;
  IF OLD.location IS DISTINCT FROM NEW.location THEN
    v_changes := array_append(v_changes, 'location');
  END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    v_changes := array_append(v_changes, 'description');
  END IF;

  -- Only proceed if there were meaningful changes
  IF array_length(v_changes, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Notify all participants with user accounts
  FOR v_participant IN
    SELECT DISTINCT COALESCE(user_id, claimed_by_user_id) as notify_user_id
    FROM participants
    WHERE event_id = NEW.id
    AND COALESCE(user_id, claimed_by_user_id) IS NOT NULL
  LOOP
    INSERT INTO notification_queue (
      recipient_user_id,
      notification_type,
      title,
      body,
      event_id,
      action_url
    ) VALUES (
      v_participant.notify_user_id,
      'event_updated',
      'Event updated: ' || NEW.title,
      'The ' || array_to_string(v_changes, ', ') || ' has been updated',
      NEW.id,
      '/events/' || NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_event_updated
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_event_updated();
```

### Trigger: On Payment Status Changed

```sql
CREATE OR REPLACE FUNCTION notify_on_payment_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_event RECORD;
  v_organizer_id UUID;
BEGIN
  -- Only notify when payment status changes to 'paid'
  IF NEW.payment_status = 'paid' AND OLD.payment_status != 'paid' THEN
    -- Get event details and organizer
    SELECT e.*, o.user_id INTO v_event, v_organizer_id
    FROM events e
    JOIN organizers o ON e.organizer_id = o.id
    WHERE e.id = NEW.event_id;

    -- Notify organizer
    INSERT INTO notification_queue (
      recipient_user_id,
      notification_type,
      title,
      body,
      event_id,
      participant_id,
      action_url
    ) VALUES (
      v_organizer_id,
      'payment_received',
      'Payment received',
      NEW.name || ' paid for ' || v_event.title,
      NEW.event_id,
      NEW.id,
      '/events/' || NEW.event_id || '/participants'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_payment_changed
  AFTER UPDATE OF payment_status ON participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_payment_changed();
```

### Helper: Check Capacity Reached

```sql
CREATE OR REPLACE FUNCTION check_and_notify_capacity_reached(p_event_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_event RECORD;
  v_organizer_id UUID;
  v_participant_count INT;
BEGIN
  -- Get event with capacity
  SELECT e.*, o.user_id INTO v_event, v_organizer_id
  FROM events e
  JOIN organizers o ON e.organizer_id = o.id
  WHERE e.id = p_event_id;

  -- Skip if no capacity limit
  IF v_event.max_participants IS NULL THEN
    RETURN;
  END IF;

  -- Count current participants
  SELECT COUNT(*) INTO v_participant_count
  FROM participants
  WHERE event_id = p_event_id;

  -- Notify if exactly at capacity (only once)
  IF v_participant_count = v_event.max_participants THEN
    INSERT INTO notification_queue (
      recipient_user_id,
      notification_type,
      title,
      body,
      event_id,
      action_url
    ) VALUES (
      v_organizer_id,
      'capacity_reached',
      v_event.title || ' is now full!',
      'Your event has reached maximum capacity (' || v_event.max_participants || ' participants)',
      p_event_id,
      '/events/' || p_event_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Edge Functions

### Function: `send-push`

Processes the notification queue and sends push notifications.

```typescript
// supabase/functions/send-push/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!

interface QueueItem {
  id: string
  recipient_user_id: string
  notification_type: string
  title: string
  body: string
  event_id: string | null
  action_url: string | null
}

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Fetch pending notifications ready to send
  const { data: queue, error: queueError } = await supabase
    .from('notification_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .limit(100)

  if (queueError || !queue) {
    return new Response(JSON.stringify({ error: queueError }), { status: 500 })
  }

  const results = []

  for (const item of queue as QueueItem[]) {
    // Mark as processing
    await supabase
      .from('notification_queue')
      .update({ status: 'processing', attempts: item.attempts + 1 })
      .eq('id', item.id)

    try {
      // Check user preferences
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', item.recipient_user_id)
        .single()

      // Check if user wants this notification type
      if (prefs && !shouldSendNotification(prefs, item.notification_type)) {
        await markAsSkipped(supabase, item.id)
        continue
      }

      // Get user's push subscriptions
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', item.recipient_user_id)
        .eq('active', true)

      if (!subscriptions || subscriptions.length === 0) {
        await markAsSkipped(supabase, item.id, 'No active subscriptions')
        continue
      }

      // Save to notifications inbox
      await supabase.from('notifications').insert({
        recipient_user_id: item.recipient_user_id,
        type: item.notification_type,
        title: item.title,
        body: item.body,
        event_id: item.event_id,
        action_url: item.action_url,
      })

      // Send to all subscriptions
      for (const sub of subscriptions) {
        await sendWebPush(sub, {
          title: item.title,
          body: item.body,
          data: {
            type: item.notification_type,
            url: item.action_url,
            event_id: item.event_id,
          },
        })
      }

      // Mark as sent
      await supabase
        .from('notification_queue')
        .update({ status: 'sent', processed_at: new Date().toISOString() })
        .eq('id', item.id)

      results.push({ id: item.id, status: 'sent' })
    } catch (error) {
      await supabase
        .from('notification_queue')
        .update({
          status: item.attempts >= 3 ? 'failed' : 'pending',
          last_error: error.message
        })
        .eq('id', item.id)

      results.push({ id: item.id, status: 'error', error: error.message })
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function shouldSendNotification(prefs: any, type: string): boolean {
  if (!prefs.push_enabled) return false

  const prefMap: Record<string, string> = {
    'new_signup': 'notify_new_signup',
    'withdrawal': 'notify_withdrawal',
    'payment_received': 'notify_payment_received',
    'capacity_reached': 'notify_capacity_reached',
    'signup_confirmed': 'notify_signup_confirmed',
    'event_updated': 'notify_event_updated',
    'event_cancelled': 'notify_event_cancelled',
    'payment_reminder': 'notify_payment_reminder',
    'waitlist_promotion': 'notify_waitlist_promotion',
  }

  const prefKey = prefMap[type]
  return prefKey ? prefs[prefKey] !== false : true
}

async function markAsSkipped(supabase: any, id: string, reason?: string) {
  await supabase
    .from('notification_queue')
    .update({
      status: 'skipped',
      processed_at: new Date().toISOString(),
      last_error: reason || 'User preferences'
    })
    .eq('id', id)
}

async function sendWebPush(subscription: any, payload: any) {
  // Web Push implementation using web-push protocol
  // This would use the VAPID keys to sign and encrypt the payload
  // Implementation details depend on chosen library
}
```

### Function: `process-scheduled` (Cron)

Schedules payment reminders 24hr after events.

```typescript
// supabase/functions/process-scheduled/index.ts
// Runs hourly via pg_cron or Supabase scheduled function

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Find events that ended 24 hours ago with unpaid participants
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)

  const { data: unpaidParticipants } = await supabase
    .from('participants')
    .select(`
      id,
      name,
      user_id,
      claimed_by_user_id,
      event_id,
      events!inner (
        id,
        title,
        date
      )
    `)
    .eq('payment_status', 'pending')
    .gte('events.date', twentyFiveHoursAgo.toISOString())
    .lte('events.date', twentyFourHoursAgo.toISOString())

  if (!unpaidParticipants) {
    return new Response(JSON.stringify({ queued: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let queued = 0

  for (const participant of unpaidParticipants) {
    const userId = participant.user_id || participant.claimed_by_user_id
    if (!userId) continue

    // Check if we already sent a reminder for this participant
    const { data: existing } = await supabase
      .from('notification_queue')
      .select('id')
      .eq('participant_id', participant.id)
      .eq('notification_type', 'payment_reminder')
      .single()

    if (existing) continue

    // Queue payment reminder
    await supabase.from('notification_queue').insert({
      recipient_user_id: userId,
      notification_type: 'payment_reminder',
      title: 'Payment reminder',
      body: `Don't forget to pay for ${participant.events.title}`,
      event_id: participant.event_id,
      participant_id: participant.id,
      action_url: `/events/${participant.event_id}`,
    })

    queued++
  }

  // Trigger send-push function to process the queue
  await supabase.functions.invoke('send-push')

  return new Response(JSON.stringify({ queued }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

---

## Frontend Implementation

### Service: `pushSubscriptionService.ts`

```typescript
// src/services/pushSubscriptionService.ts
import { supabase } from '@/lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const pushSubscriptionService = {
  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  },

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  },

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    const permission = await Notification.requestPermission();
    return permission;
  },

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.isSupported()) return null;

    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Save to database
    const { endpoint, keys } = subscription.toJSON();

    await supabase.from('push_subscriptions').upsert({
      endpoint,
      p256dh_key: keys?.p256dh,
      auth_key: keys?.auth,
      user_agent: navigator.userAgent,
    }, {
      onConflict: 'endpoint',
    });

    return subscription;
  },

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Remove from database
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint);

      // Unsubscribe from browser
      await subscription.unsubscribe();
    }
  },

  /**
   * Check if currently subscribed
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) return false;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription !== null;
  },
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
```

### Service: `notificationService.ts`

```typescript
// src/services/notificationService.ts
import { supabase } from '@/lib/supabase';
import type { Notification, NotificationPreferences } from '@/types/notifications';

export const notificationService = {
  /**
   * Get user's notifications (inbox)
   */
  async getNotifications(limit = 50): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null);

    if (error) throw error;
    return count || 0;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) throw error;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);

    if (error) throw error;
  },

  /**
   * Get user's notification preferences
   */
  async getPreferences(): Promise<NotificationPreferences | null> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Update notification preferences
   */
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        ...preferences,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) throw error;
  },
};
```

### Custom Service Worker

```typescript
// public/sw-custom.js (imported by vite-plugin-pwa)

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/icon-192x192.svg',
    badge: '/icon-192x192.svg',
    data: data.data,
    tag: data.data?.type || 'default', // Collapse similar notifications
    renotify: true,
    actions: [
      { action: 'open', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Open new window
        return clients.openWindow(url);
      })
  );
});
```

### Hook: `useNotifications`

```typescript
// src/hooks/useNotifications.ts
import { useState, useEffect, useCallback } from 'react';
import { notificationService, pushSubscriptionService } from '@/services';
import type { Notification } from '@/types/notifications';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
    checkSubscription();
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const [notifs, count] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    const subscribed = await pushSubscriptionService.isSubscribed();
    const perm = pushSubscriptionService.getPermissionStatus();
    setIsSubscribed(subscribed);
    setPermission(perm);
  }, []);

  const subscribe = useCallback(async () => {
    const perm = await pushSubscriptionService.requestPermission();
    setPermission(perm);

    if (perm === 'granted') {
      await pushSubscriptionService.subscribe();
      setIsSubscribed(true);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    await pushSubscriptionService.unsubscribe();
    setIsSubscribed(false);
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    await notificationService.markAsRead(id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationService.markAllAsRead();
    setNotifications(prev =>
      prev.map(n => ({ ...n, read_at: new Date().toISOString() }))
    );
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    markAsRead,
    markAllAsRead,
    refresh: loadNotifications,
  };
}
```

---

## Implementation Phases

### Phase 1: Database Foundation
**Files to create:**
- [ ] `supabase/migrations/XXXXXX_create_notification_tables.sql`
- [ ] `src/types/notifications.ts`

**Tasks:**
1. Create all four tables with RLS policies
2. Define TypeScript types for notifications
3. Test table creation locally

### Phase 2: Notification Triggers
**Files to create:**
- [ ] `supabase/migrations/XXXXXX_notification_triggers.sql`

**Tasks:**
1. Create trigger functions for participant events
2. Create trigger functions for event updates
3. Create payment status change trigger
4. Create capacity check helper function
5. Test triggers locally with manual inserts

### Phase 3: Frontend Services
**Files to create:**
- [ ] `src/services/notificationService.ts`
- [ ] `src/services/pushSubscriptionService.ts`
- [ ] `src/services/notificationPreferenceService.ts`
- [ ] Update `src/services/index.ts`

**Tasks:**
1. Implement notification inbox service
2. Implement push subscription service
3. Implement preferences service
4. Export from services index

### Phase 4: Service Worker Enhancement
**Files to create/modify:**
- [ ] `public/sw-push.js` (custom SW code)
- [ ] Update `vite.config.ts` to inject custom SW

**Tasks:**
1. Add push event listener
2. Add notification click handler
3. Configure vite-plugin-pwa to include custom code

### Phase 5: UI Components
**Files to create:**
- [ ] `src/components/notifications/NotificationCenter.tsx`
- [ ] `src/components/notifications/NotificationBadge.tsx`
- [ ] `src/components/notifications/NotificationItem.tsx`
- [ ] `src/components/notifications/PushPermissionPrompt.tsx`
- [ ] `src/hooks/useNotifications.ts`

**Tasks:**
1. Create notification center/inbox component
2. Create unread badge component
3. Create permission request UI
4. Integrate with navigation

### Phase 6: Settings Integration
**Files to modify:**
- [ ] `src/pages/SettingsPage.tsx`

**Tasks:**
1. Replace localStorage with database preferences
2. Add push notification toggle
3. Add per-notification-type preferences

### Phase 7: Edge Functions
**Files to create:**
- [ ] `supabase/functions/send-push/index.ts`
- [ ] `supabase/functions/process-scheduled/index.ts`

**Tasks:**
1. Implement queue processor
2. Implement Web Push sending
3. Implement scheduled job for payment reminders
4. Configure VAPID keys in Supabase secrets

### Phase 8: Testing & Polish
**Tasks:**
1. Test all notification triggers
2. Test push delivery across devices
3. Test notification click deep linking
4. Test preferences respect
5. Add loading states and error handling

---

## Environment Variables

```env
# Frontend (.env)
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key

# Supabase Edge Functions (secrets)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your@email.com
```

**Generate VAPID keys:**
```bash
npx web-push generate-vapid-keys
```

---

## File Structure (Final)

```
src/
├── components/
│   └── notifications/
│       ├── NotificationCenter.tsx
│       ├── NotificationBadge.tsx
│       ├── NotificationItem.tsx
│       └── PushPermissionPrompt.tsx
├── hooks/
│   └── useNotifications.ts
├── services/
│   ├── notificationService.ts
│   ├── notificationPreferenceService.ts
│   ├── pushSubscriptionService.ts
│   └── index.ts (updated)
└── types/
    └── notifications.ts

supabase/
├── functions/
│   ├── send-push/
│   │   └── index.ts
│   └── process-scheduled/
│       └── index.ts
└── migrations/
    ├── XXXXXX_create_notification_tables.sql
    └── XXXXXX_notification_triggers.sql

public/
└── sw-push.js
```

---

## Success Metrics

1. **Delivery Rate**: >95% of queued notifications delivered
2. **Latency**: Instant notifications delivered within 5 seconds
3. **Permission Grant Rate**: Track how many users enable push
4. **Engagement**: Click-through rate on notifications
