-- Migration: Create notification system tables
-- Phase 1: Database Foundation for push notifications

-- ============================================================================
-- Table: notification_preferences
-- Stores user preferences for which notifications they want to receive
-- ============================================================================
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

-- RLS Policies for notification_preferences
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

-- ============================================================================
-- Table: push_subscriptions
-- Stores Web Push subscription data for each user device
-- ============================================================================
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

-- Index for quick lookups by user
CREATE INDEX idx_push_subscriptions_user_active
  ON push_subscriptions(user_id)
  WHERE active = true;

-- RLS Policies for push_subscriptions
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

-- ============================================================================
-- Table: notifications
-- The notification inbox - stores all sent notifications for history
-- ============================================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification content
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Related entities (for deep linking)
  event_id TEXT REFERENCES events(id) ON DELETE SET NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Deep link URL path
  action_url TEXT,

  -- State
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_recipient_created
  ON notifications(recipient_user_id, created_at DESC);

CREATE INDEX idx_notifications_unread
  ON notifications(recipient_user_id)
  WHERE read_at IS NULL;

-- RLS Policies for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_user_id);

-- ============================================================================
-- Table: notification_queue
-- Queue for pending notification deliveries (processed by Edge Functions)
-- ============================================================================
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
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_url TEXT,

  -- Scheduling (for delayed notifications like payment reminders)
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),

  -- Processing state
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts INT DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Index for processing pending notifications
CREATE INDEX idx_notification_queue_pending
  ON notification_queue(scheduled_for)
  WHERE status = 'pending';

-- RLS: Only service role (Edge Functions) can access this table
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
-- No user policies - only service role can access

-- ============================================================================
-- Comments documenting notification types
-- ============================================================================
COMMENT ON TABLE notifications IS 'Notification inbox. Types:
- new_signup: Organizer receives when someone signs up
- withdrawal: Organizer receives when someone withdraws
- payment_received: Organizer receives when payment confirmed
- capacity_reached: Organizer receives when event is full
- signup_confirmed: Participant receives signup confirmation
- event_updated: Participant receives when event details change
- event_cancelled: Participant receives when event is cancelled
- payment_reminder: Participant receives 24hr after event if unpaid
- waitlist_promotion: Participant receives when promoted from waitlist';

COMMENT ON TABLE notification_queue IS 'Queue for pending push notifications. Processed by send-push Edge Function.';
COMMENT ON TABLE push_subscriptions IS 'Web Push API subscriptions for each user device.';
COMMENT ON TABLE notification_preferences IS 'User preferences for notification types and channels.';
