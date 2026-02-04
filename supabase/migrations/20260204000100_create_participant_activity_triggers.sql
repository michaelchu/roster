-- Triggers for automatically logging participant activity

-- Trigger: On participant created (joined)
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
      'slot_number', NEW.slot_number,
      'claimed_by_user_id', NEW.claimed_by_user_id
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: On participant updated (payment changes)
CREATE OR REPLACE FUNCTION log_participant_updated()
RETURNS TRIGGER AS $$
BEGIN
  -- Track payment status changes
  IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    INSERT INTO participant_activity_log (
      participant_id, event_id, activity_type, participant_name, details
    ) VALUES (
      NEW.id,
      NEW.event_id,
      'payment_updated',
      NEW.name,
      jsonb_build_object(
        'from', OLD.payment_status,
        'to', NEW.payment_status
      )
    );
  END IF;

  -- Track info updates (name, email, phone, notes)
  IF OLD.name IS DISTINCT FROM NEW.name OR
     OLD.email IS DISTINCT FROM NEW.email OR
     OLD.phone IS DISTINCT FROM NEW.phone OR
     OLD.notes IS DISTINCT FROM NEW.notes THEN

    INSERT INTO participant_activity_log (
      participant_id, event_id, activity_type, participant_name, details
    ) VALUES (
      NEW.id,
      NEW.event_id,
      'info_updated',
      NEW.name,
      jsonb_build_object(
        'name', CASE WHEN OLD.name IS DISTINCT FROM NEW.name
          THEN jsonb_build_object('from', OLD.name, 'to', NEW.name)
          ELSE NULL END,
        'email', CASE WHEN OLD.email IS DISTINCT FROM NEW.email
          THEN jsonb_build_object('from', OLD.email, 'to', NEW.email)
          ELSE NULL END,
        'phone', CASE WHEN OLD.phone IS DISTINCT FROM NEW.phone
          THEN jsonb_build_object('from', OLD.phone, 'to', NEW.phone)
          ELSE NULL END,
        'notes', CASE WHEN OLD.notes IS DISTINCT FROM NEW.notes
          THEN jsonb_build_object('from', OLD.notes, 'to', NEW.notes)
          ELSE NULL END
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: Before participant deleted (withdrew)
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
      'slot_number', OLD.slot_number,
      'payment_status', OLD.payment_status
    )
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: On participant_labels insert (label added)
CREATE OR REPLACE FUNCTION log_label_added()
RETURNS TRIGGER AS $$
DECLARE
  v_participant RECORD;
  v_label RECORD;
BEGIN
  SELECT * INTO v_participant FROM participants WHERE id = NEW.participant_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT * INTO v_label FROM labels WHERE id = NEW.label_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO participant_activity_log (
    participant_id, event_id, activity_type, participant_name, details
  ) VALUES (
    NEW.participant_id,
    v_participant.event_id,
    'label_added',
    v_participant.name,
    jsonb_build_object('label_id', NEW.label_id, 'label_name', v_label.name)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger: On participant_labels delete (label removed)
CREATE OR REPLACE FUNCTION log_label_removed()
RETURNS TRIGGER AS $$
DECLARE
  v_participant RECORD;
  v_label RECORD;
BEGIN
  SELECT * INTO v_participant FROM participants WHERE id = OLD.participant_id;
  -- Skip logging if participant already deleted (cascade delete scenario)
  IF NOT FOUND THEN RETURN OLD; END IF;

  SELECT * INTO v_label FROM labels WHERE id = OLD.label_id;
  -- Skip logging if label already deleted (cascade delete scenario)
  IF NOT FOUND THEN RETURN OLD; END IF;

  INSERT INTO participant_activity_log (
    participant_id, event_id, activity_type, participant_name, details
  ) VALUES (
    OLD.participant_id,
    v_participant.event_id,
    'label_removed',
    v_participant.name,
    jsonb_build_object('label_id', OLD.label_id, 'label_name', v_label.name)
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers on participants table
CREATE TRIGGER trigger_log_participant_joined
  AFTER INSERT ON participants
  FOR EACH ROW
  EXECUTE FUNCTION log_participant_joined();

CREATE TRIGGER trigger_log_participant_updated
  AFTER UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION log_participant_updated();

CREATE TRIGGER trigger_log_participant_withdrew
  BEFORE DELETE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION log_participant_withdrew();

-- Create triggers on participant_labels table
CREATE TRIGGER trigger_log_label_added
  AFTER INSERT ON participant_labels
  FOR EACH ROW
  EXECUTE FUNCTION log_label_added();

CREATE TRIGGER trigger_log_label_removed
  BEFORE DELETE ON participant_labels
  FOR EACH ROW
  EXECUTE FUNCTION log_label_removed();
