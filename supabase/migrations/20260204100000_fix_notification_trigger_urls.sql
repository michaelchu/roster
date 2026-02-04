-- Migration: Fix notification trigger URLs
-- The triggers were using /events/:eventId which doesn't exist
-- The correct route for event detail is /signup/:eventId

-- ============================================================================
-- Update helper function: Check if capacity reached
-- ============================================================================
CREATE OR REPLACE FUNCTION check_and_notify_capacity_reached(p_event_id TEXT)
RETURNS VOID AS $$
DECLARE
  v_event RECORD;
  v_participant_count INT;
BEGIN
  -- Get event with capacity and organizer
  SELECT e.id, e.name, e.max_participants, e.organizer_id
  INTO v_event
  FROM events e
  WHERE e.id = p_event_id;

  -- Skip if no capacity limit
  IF v_event.max_participants IS NULL THEN
    RETURN;
  END IF;

  -- Count current participants
  SELECT COUNT(*) INTO v_participant_count
  FROM participants
  WHERE event_id = p_event_id;

  -- Notify if exactly at capacity (only once when reaching capacity)
  IF v_participant_count = v_event.max_participants THEN
    INSERT INTO notification_queue (
      recipient_user_id,
      notification_type,
      title,
      body,
      event_id,
      action_url
    ) VALUES (
      v_event.organizer_id,
      'capacity_reached',
      v_event.name || ' is now full!',
      'Your event has reached maximum capacity (' || v_event.max_participants || ' participants)',
      p_event_id,
      '/signup/' || p_event_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update trigger: On participant created
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_on_participant_created()
RETURNS TRIGGER AS $$
DECLARE
  v_event RECORD;
  v_participant_user_id UUID;
BEGIN
  -- Get event details including organizer
  SELECT e.id, e.name, e.organizer_id, e.max_participants
  INTO v_event
  FROM events e
  WHERE e.id = NEW.event_id;

  -- Get the user ID of the participant (self-registered or claimed)
  v_participant_user_id := COALESCE(NEW.user_id, NEW.claimed_by_user_id);

  -- 1. Notify organizer of new signup (don't notify if organizer signed up themselves)
  IF v_event.organizer_id != v_participant_user_id OR v_participant_user_id IS NULL THEN
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
      v_event.organizer_id,
      'new_signup',
      'New signup for ' || v_event.name,
      NEW.name || ' just signed up',
      NEW.event_id,
      NEW.id,
      v_participant_user_id,
      '/signup/' || NEW.event_id
    );
  END IF;

  -- 2. Notify participant of confirmation (if they have a user account)
  -- Don't send confirmation to organizer (they know they signed up)
  IF v_participant_user_id IS NOT NULL AND v_participant_user_id != v_event.organizer_id THEN
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
      'You''re registered for ' || v_event.name,
      NEW.event_id,
      NEW.id,
      '/signup/' || NEW.event_id
    );
  END IF;

  -- 3. Check if capacity reached (and notify organizer)
  PERFORM check_and_notify_capacity_reached(NEW.event_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update trigger: On participant deleted (withdrawal)
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_on_participant_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_event RECORD;
  v_participant_user_id UUID;
BEGIN
  -- Get event details including organizer
  SELECT e.id, e.name, e.organizer_id
  INTO v_event
  FROM events e
  WHERE e.id = OLD.event_id;

  -- Get the user ID of the participant
  v_participant_user_id := COALESCE(OLD.user_id, OLD.claimed_by_user_id);

  -- Notify organizer of withdrawal (don't notify if organizer withdrew themselves)
  IF v_event.organizer_id != v_participant_user_id OR v_participant_user_id IS NULL THEN
    INSERT INTO notification_queue (
      recipient_user_id,
      notification_type,
      title,
      body,
      event_id,
      actor_user_id,
      action_url
    ) VALUES (
      v_event.organizer_id,
      'withdrawal',
      'Withdrawal from ' || v_event.name,
      OLD.name || ' has withdrawn',
      OLD.event_id,
      v_participant_user_id,
      '/signup/' || OLD.event_id
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update trigger: On event updated
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_on_event_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_participant RECORD;
  v_changes TEXT[];
  v_changes_text TEXT;
BEGIN
  -- Track which fields changed (only notify for significant changes)
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    v_changes := array_append(v_changes, 'title');
  END IF;
  IF OLD.datetime IS DISTINCT FROM NEW.datetime THEN
    v_changes := array_append(v_changes, 'date/time');
  END IF;
  IF OLD.end_datetime IS DISTINCT FROM NEW.end_datetime THEN
    -- Only add if not already tracking datetime change
    IF NOT ('date/time' = ANY(v_changes)) THEN
      v_changes := array_append(v_changes, 'end time');
    END IF;
  END IF;
  IF OLD.location IS DISTINCT FROM NEW.location THEN
    v_changes := array_append(v_changes, 'location');
  END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    v_changes := array_append(v_changes, 'description');
  END IF;

  -- Only proceed if there were meaningful changes
  IF array_length(v_changes, 1) IS NULL OR array_length(v_changes, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Build human-readable changes text
  v_changes_text := array_to_string(v_changes, ', ');

  -- Notify all participants with user accounts (except the organizer who made the change)
  FOR v_participant IN
    SELECT DISTINCT COALESCE(user_id, claimed_by_user_id) as notify_user_id
    FROM participants
    WHERE event_id = NEW.id
      AND COALESCE(user_id, claimed_by_user_id) IS NOT NULL
      AND COALESCE(user_id, claimed_by_user_id) != NEW.organizer_id
  LOOP
    INSERT INTO notification_queue (
      recipient_user_id,
      notification_type,
      title,
      body,
      event_id,
      actor_user_id,
      action_url
    ) VALUES (
      v_participant.notify_user_id,
      'event_updated',
      'Event updated: ' || NEW.name,
      'The ' || v_changes_text || ' has been updated',
      NEW.id,
      NEW.organizer_id,
      '/signup/' || NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Update trigger: On payment status changed
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_on_payment_changed()
RETURNS TRIGGER AS $$
DECLARE
  v_event RECORD;
BEGIN
  -- Only notify when payment status changes to 'paid'
  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
    -- Get event details including organizer
    SELECT e.id, e.name, e.organizer_id
    INTO v_event
    FROM events e
    WHERE e.id = NEW.event_id;

    -- Notify organizer of payment
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
      v_event.organizer_id,
      'payment_received',
      'Payment received',
      NEW.name || ' paid for ' || v_event.name,
      NEW.event_id,
      NEW.id,
      COALESCE(NEW.user_id, NEW.claimed_by_user_id),
      '/signup/' || NEW.event_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Fix existing notifications with wrong URLs
-- ============================================================================
UPDATE notifications
SET action_url = REGEXP_REPLACE(action_url, '^/events/([^/]+)(/participants)?$', '/signup/\1')
WHERE action_url ~ '^/events/[^/]+(/participants)?$';

UPDATE notification_queue
SET action_url = REGEXP_REPLACE(action_url, '^/events/([^/]+)(/participants)?$', '/signup/\1')
WHERE action_url ~ '^/events/[^/]+(/participants)?$';
