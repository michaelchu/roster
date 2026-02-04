-- Migration: Add RPC function for queueing notifications
--
-- Problem: The service layer moved notification queueing from DB triggers to the
-- application code, but the notification_queue table has an RLS policy that only
-- allows users to insert notifications for themselves:
--   WITH CHECK (recipient_user_id = auth.uid())
--
-- This means when a participant signs up, they can queue their own signup_confirmed
-- notification, but they CANNOT queue the organizer's new_signup notification because
-- the organizer is a different user.
--
-- Solution: Create an RPC function with SECURITY DEFINER that can insert notifications
-- for any recipient. The function validates input and can be called by authenticated users.

-- Create the queue notification RPC function
CREATE OR REPLACE FUNCTION queue_notification(
  p_recipient_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_event_id TEXT DEFAULT NULL,
  p_participant_id UUID DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Validate notification type
  IF p_notification_type NOT IN (
    'new_signup', 'withdrawal', 'payment_received', 'capacity_reached',
    'signup_confirmed', 'event_updated', 'event_cancelled',
    'payment_reminder', 'waitlist_promotion'
  ) THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_notification_type;
  END IF;

  -- Insert into notification queue
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
    p_recipient_user_id,
    p_notification_type,
    p_title,
    p_body,
    p_event_id,
    p_participant_id,
    p_actor_user_id,
    p_action_url
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION queue_notification TO authenticated;

-- Add comment
COMMENT ON FUNCTION queue_notification IS
'Queues a notification for delivery via the send-push Edge Function.
Uses SECURITY DEFINER to bypass RLS, allowing users to queue notifications
for other users (e.g., participant queues organizer notification).
Validates notification_type against known types.';
