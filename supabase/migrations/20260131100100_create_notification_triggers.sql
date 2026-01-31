-- Migration: Create notification triggers
-- Phase 2: Database triggers for automatic notification queueing

-- ============================================================================
-- Helper function: Check if capacity reached and notify organizer
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
      '/events/' || p_event_id
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Trigger: On participant created
-- Notifies organizer of new signup and participant of confirmation
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
      '/events/' || NEW.event_id || '/participants'
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

-- ============================================================================
-- Trigger: On participant deleted (withdrawal)
-- Notifies organizer when someone withdraws
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
      '/events/' || OLD.event_id || '/participants'
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_participant_deleted
  AFTER DELETE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_participant_deleted();

-- ============================================================================
-- Trigger: On event updated
-- Notifies all participants when significant event details change
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

-- ============================================================================
-- Trigger: On event deleted (cancelled)
-- Notifies all participants when an event is cancelled
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_on_event_deleted()
RETURNS TRIGGER AS $$
DECLARE
  v_participant RECORD;
BEGIN
  -- Notify all participants with user accounts
  FOR v_participant IN
    SELECT DISTINCT COALESCE(user_id, claimed_by_user_id) as notify_user_id
    FROM participants
    WHERE event_id = OLD.id
      AND COALESCE(user_id, claimed_by_user_id) IS NOT NULL
      AND COALESCE(user_id, claimed_by_user_id) != OLD.organizer_id
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
      'event_cancelled',
      'Event cancelled: ' || OLD.name,
      'The event "' || OLD.name || '" has been cancelled',
      NULL, -- event_id is NULL since event is being deleted
      OLD.organizer_id,
      '/events' -- redirect to events list since event no longer exists
    );
  END LOOP;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_event_deleted
  BEFORE DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_event_deleted();

-- ============================================================================
-- Trigger: On payment status changed
-- Notifies organizer when payment is received
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

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION notify_on_participant_created() IS 'Queues notifications when a participant signs up: organizer gets new_signup, participant gets signup_confirmed';
COMMENT ON FUNCTION notify_on_participant_deleted() IS 'Queues withdrawal notification to organizer when participant is removed';
COMMENT ON FUNCTION notify_on_event_updated() IS 'Queues event_updated notifications to all participants when significant event details change';
COMMENT ON FUNCTION notify_on_event_deleted() IS 'Queues event_cancelled notifications to all participants before event is deleted';
COMMENT ON FUNCTION notify_on_payment_changed() IS 'Queues payment_received notification to organizer when payment status becomes paid';
COMMENT ON FUNCTION check_and_notify_capacity_reached(TEXT) IS 'Checks if event reached capacity and queues capacity_reached notification to organizer';
