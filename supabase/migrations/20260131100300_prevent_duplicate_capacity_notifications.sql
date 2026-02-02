-- Migration: Prevent duplicate capacity_reached notifications
-- Addresses race condition where simultaneous signups reaching capacity
-- could both insert capacity_reached notifications

-- ============================================================================
-- Add unique partial index to prevent duplicate capacity notifications
-- ============================================================================
-- This index ensures that only one pending capacity_reached notification can exist
-- per event at a time. The partial index only applies to pending/processing
-- notifications, so historical notifications (sent/failed) don't interfere.
CREATE UNIQUE INDEX idx_notification_queue_unique_capacity_reached
  ON notification_queue(event_id, notification_type)
  WHERE notification_type = 'capacity_reached' 
    AND status IN ('pending', 'processing');

-- ============================================================================
-- Update check_and_notify_capacity_reached to use exception handling
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
    -- Use exception handler to catch unique_violation from the partial index
    -- This handles the race condition where multiple simultaneous signups
    -- both try to insert the same notification
    BEGIN
      INSERT INTO notification_queue (
        recipient_user_id,
        notification_type,
        title,
        body,
        event_id,
        action_url,
        status
      ) VALUES (
        v_event.organizer_id,
        'capacity_reached',
        v_event.name || ' is now full!',
        'Your event has reached maximum capacity (' || v_event.max_participants || ' participants)',
        p_event_id,
        '/events/' || p_event_id,
        'pending'
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- Silently ignore if notification already exists
        NULL;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON INDEX idx_notification_queue_unique_capacity_reached IS 
  'Prevents duplicate capacity_reached notifications when multiple participants sign up simultaneously and reach capacity';
