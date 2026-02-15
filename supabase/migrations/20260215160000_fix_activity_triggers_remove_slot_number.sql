-- Fix activity log trigger functions that still reference the removed slot_number column

-- Update log_participant_joined to remove slot_number from details
CREATE OR REPLACE FUNCTION log_participant_joined()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO participant_activity_log (
    participant_id, event_id, activity_type, participant_name, details
  ) VALUES (
    NEW.id,
    NEW.event_id,
    'joined',
    NEW.name,
    jsonb_build_object(
      'claimed_by_user_id', NEW.claimed_by_user_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update log_participant_withdrew to remove slot_number from details
CREATE OR REPLACE FUNCTION log_participant_withdrew()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO participant_activity_log (
    participant_id, event_id, activity_type, participant_name, details
  ) VALUES (
    OLD.id,
    OLD.event_id,
    'withdrew',
    OLD.name,
    jsonb_build_object(
      'payment_status', OLD.payment_status
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
