-- Migration: Add RPC function for logging participant activity
--
-- Problem: The participant_activity_log INSERT RLS policy only allows event
-- organizers to insert rows. But when a participant self-registers for an event,
-- the activity logging runs under the participant's auth context, not the
-- organizer's. This causes an RLS violation (error 42501).
--
-- Solution: Create an RPC function with SECURITY DEFINER that bypasses RLS,
-- following the same pattern as queue_notification(). The function validates
-- activity_type and requires the caller to be authenticated.

-- Create the log_participant_activity RPC function
CREATE OR REPLACE FUNCTION log_participant_activity(
  p_participant_id UUID,
  p_event_id TEXT,
  p_activity_type TEXT,
  p_participant_name TEXT,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  -- Validate activity type
  IF p_activity_type NOT IN (
    'joined', 'withdrew', 'payment_updated',
    'info_updated', 'label_added', 'label_removed'
  ) THEN
    RAISE EXCEPTION 'Invalid activity type: %', p_activity_type;
  END IF;

  -- Validate that the event exists
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;

  -- Insert into activity log
  INSERT INTO participant_activity_log (
    participant_id,
    event_id,
    activity_type,
    participant_name,
    details
  ) VALUES (
    p_participant_id,
    p_event_id,
    p_activity_type,
    p_participant_name,
    p_details
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION log_participant_activity TO authenticated;

-- Add comment
COMMENT ON FUNCTION log_participant_activity IS
'Logs participant activity (joins, withdrawals, updates, etc.) to the audit log.
Uses SECURITY DEFINER to bypass RLS, allowing any authenticated user to log
activity regardless of whether they are the event organizer. This is needed
because participants can trigger activity logging (e.g., self-registration)
but the INSERT RLS policy only allows organizers.';
