-- Migration: Add missing indexes for foreign keys
-- These indexes improve query performance for common lookups

-- Index for notification_queue.recipient_user_id
-- Critical for looking up pending notifications by user
CREATE INDEX IF NOT EXISTS idx_notification_queue_recipient
  ON notification_queue(recipient_user_id);

-- Index for notification_queue.event_id
-- Used when fetching notifications related to an event
CREATE INDEX IF NOT EXISTS idx_notification_queue_event
  ON notification_queue(event_id)
  WHERE event_id IS NOT NULL;

-- Index for notifications.event_id
-- Used when fetching notifications related to an event
CREATE INDEX IF NOT EXISTS idx_notifications_event
  ON notifications(event_id)
  WHERE event_id IS NOT NULL;
