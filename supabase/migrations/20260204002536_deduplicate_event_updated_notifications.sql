-- Migration: Deduplicate event_updated notifications
-- Prevents participants from receiving multiple notifications when an organizer
-- makes rapid successive edits to an event (e.g., fixing typos, adjusting details)

-- ============================================================================
-- Add unique partial index to prevent duplicate event_updated notifications
-- ============================================================================
-- This index ensures that only one pending event_updated notification can exist
-- per recipient per event at a time. Once the notification is processed (sent/skipped/failed),
-- a new notification can be created for subsequent edits.
CREATE UNIQUE INDEX idx_notification_queue_unique_event_updated
  ON notification_queue(event_id, recipient_user_id, notification_type)
  WHERE notification_type = 'event_updated'
    AND status IN ('pending', 'processing');

-- ============================================================================
-- Update notify_on_event_updated to use exception handling
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
    -- Use exception handler to catch unique_violation from the partial index
    -- This deduplicates rapid successive edits so participants don't get spammed
    BEGIN
      INSERT INTO notification_queue (
        recipient_user_id,
        notification_type,
        title,
        body,
        event_id,
        actor_user_id,
        action_url,
        status
      ) VALUES (
        v_participant.notify_user_id,
        'event_updated',
        'Event updated: ' || NEW.name,
        'The ' || v_changes_text || ' has been updated',
        NEW.id,
        NEW.organizer_id,
        '/events/' || NEW.id,
        'pending'
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- A pending notification already exists for this recipient/event
        -- Silently skip - the user will see the event's current state when they view it
        NULL;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON INDEX idx_notification_queue_unique_event_updated IS
  'Prevents duplicate event_updated notifications when organizer makes rapid successive edits. Only one pending notification per recipient per event.';

COMMENT ON FUNCTION notify_on_event_updated() IS
  'Queues event_updated notifications to all participants when significant event details change. Deduplicates rapid edits using unique index.';
