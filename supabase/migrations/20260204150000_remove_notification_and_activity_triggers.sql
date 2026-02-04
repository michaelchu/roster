-- Migration: Remove notification and activity logging triggers
-- Business logic has been moved from DB triggers to the service layer
-- This reduces migration overhead for business logic changes and improves testability

-- ============================================================================
-- DROP NOTIFICATION TRIGGERS
-- ============================================================================

-- Drop trigger_participant_created (queues new_signup, signup_confirmed, capacity_reached)
DROP TRIGGER IF EXISTS trigger_participant_created ON participants;

-- Drop trigger_participant_deleted (queues withdrawal notification)
DROP TRIGGER IF EXISTS trigger_participant_deleted ON participants;

-- Drop trigger_event_updated (queues event_updated notifications)
DROP TRIGGER IF EXISTS trigger_event_updated ON events;

-- Drop trigger_event_deleted (queues event_cancelled notifications)
DROP TRIGGER IF EXISTS trigger_event_deleted ON events;

-- Drop trigger_payment_changed (queues payment_received notification)
DROP TRIGGER IF EXISTS trigger_payment_changed ON participants;

-- ============================================================================
-- DROP NOTIFICATION FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS notify_on_participant_created();
DROP FUNCTION IF EXISTS notify_on_participant_deleted();
DROP FUNCTION IF EXISTS notify_on_event_updated();
DROP FUNCTION IF EXISTS notify_on_event_deleted();
DROP FUNCTION IF EXISTS notify_on_payment_changed();
DROP FUNCTION IF EXISTS check_and_notify_capacity_reached(TEXT);

-- ============================================================================
-- DROP ACTIVITY LOGGING TRIGGERS
-- ============================================================================

-- Drop participant activity triggers
DROP TRIGGER IF EXISTS trigger_log_participant_joined ON participants;
DROP TRIGGER IF EXISTS trigger_log_participant_updated ON participants;
DROP TRIGGER IF EXISTS trigger_log_participant_withdrew ON participants;

-- Drop label activity triggers
DROP TRIGGER IF EXISTS trigger_log_label_added ON participant_labels;
DROP TRIGGER IF EXISTS trigger_log_label_removed ON participant_labels;

-- ============================================================================
-- DROP ACTIVITY LOGGING FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS log_participant_joined();
DROP FUNCTION IF EXISTS log_participant_updated();
DROP FUNCTION IF EXISTS log_participant_withdrew();
DROP FUNCTION IF EXISTS log_label_added();
DROP FUNCTION IF EXISTS log_label_removed();

-- ============================================================================
-- KEEP THE FOLLOWING (still needed):
-- - notification_queue table (service layer inserts into it)
-- - notifications table (stores delivered notifications)
-- - participant_activity_log table (service layer inserts into it)
-- - trigger_notification_queue_send_push (calls Edge Function when queue has items)
-- - Data integrity triggers (capacity checks, slot assignment, ownership protection)
-- ============================================================================

-- Add comments explaining the change
COMMENT ON TABLE notification_queue IS 'Queue for push notifications. Items are now inserted by the service layer instead of DB triggers.';
COMMENT ON TABLE participant_activity_log IS 'Activity log for participant actions. Items are now inserted by the service layer instead of DB triggers.';
