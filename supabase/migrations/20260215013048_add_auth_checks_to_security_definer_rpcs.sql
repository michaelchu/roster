-- Migration: Add auth checks to SECURITY DEFINER RPC functions
--
-- Problem: Several SECURITY DEFINER functions lack authorization checks,
-- allowing any authenticated user to call them with arbitrary parameters.
-- This means a malicious user could:
--   - Queue notifications to any user (spam)
--   - Inject fake audit log entries for any event
--   - Update payment status for any participant
--   - Add/remove members from any group
--   - Enumerate emails/avatars from any group or event
--
-- Solution: Add appropriate auth.uid() checks to each function.
-- For cross-user functions (queue_notification, log_participant_activity),
-- we only require authentication since participants legitimately create
-- records that organizers see. For admin functions, we verify ownership.

-- ============================================================================
-- 1. queue_notification: require authentication (cross-user is legitimate)
-- ============================================================================
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
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

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

-- ============================================================================
-- 2. log_participant_activity: require authentication (cross-user is legitimate)
-- ============================================================================
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
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

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

-- ============================================================================
-- 3. bulk_update_payment_status: require caller is organizer of the events
-- ============================================================================
CREATE OR REPLACE FUNCTION public.bulk_update_payment_status(
  p_participant_ids text[],
  p_payment_status text,
  p_payment_notes text DEFAULT NULL
)
RETURNS TABLE (
  updated_count integer,
  requested_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER;
  v_requested_count INTEGER;
  v_payment_marked_at TIMESTAMPTZ;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  -- Validate payment status
  IF p_payment_status NOT IN ('pending', 'paid', 'waived') THEN
    RAISE EXCEPTION 'Invalid payment status: %. Must be pending, paid, or waived', p_payment_status;
  END IF;

  -- Count requested IDs
  v_requested_count := array_length(p_participant_ids, 1);

  IF v_requested_count IS NULL OR v_requested_count = 0 THEN
    RETURN QUERY SELECT 0::integer, 0::integer;
    RETURN;
  END IF;

  -- Verify caller is the organizer of all events these participants belong to
  IF EXISTS (
    SELECT 1 FROM participants p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = ANY(p_participant_ids)
      AND e.organizer_id != auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you are not the organizer of all affected events'
      USING ERRCODE = 'P0001';
  END IF;

  -- Set payment_marked_at based on status
  IF p_payment_status = 'pending' THEN
    v_payment_marked_at := NULL;
  ELSE
    v_payment_marked_at := NOW();
  END IF;

  -- Perform atomic update
  UPDATE participants
  SET
    payment_status = p_payment_status,
    payment_marked_at = v_payment_marked_at,
    payment_notes = COALESCE(p_payment_notes, payment_notes)
  WHERE id = ANY(p_participant_ids);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN QUERY SELECT v_updated_count, v_requested_count;
END;
$$;

-- ============================================================================
-- 4. add_participants_to_group: require caller is group owner or admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_participants_to_group(
  p_group_id text,
  p_participant_ids text[]
)
RETURNS TABLE (
  added_count integer,
  skipped_count integer,
  failed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_added_count INTEGER := 0;
  v_skipped_count INTEGER := 0;
  v_user_id TEXT;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  -- Verify caller is group owner or admin
  IF NOT EXISTS (
    SELECT 1 FROM groups WHERE id = p_group_id AND organizer_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM group_admins WHERE group_id = p_group_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you are not an owner or admin of this group'
      USING ERRCODE = 'P0001';
  END IF;

  -- Process each user
  FOREACH v_user_id IN ARRAY p_participant_ids
  LOOP
    BEGIN
      INSERT INTO group_participants (group_id, user_id)
      VALUES (p_group_id, v_user_id::uuid);

      v_added_count := v_added_count + 1;
    EXCEPTION
      WHEN unique_violation THEN
        v_skipped_count := v_skipped_count + 1;
      WHEN OTHERS THEN
        v_skipped_count := v_skipped_count + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_added_count, v_skipped_count, 0;
END;
$$;

-- ============================================================================
-- 5. remove_participants_from_group: require caller is group owner or admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.remove_participants_from_group(
  p_group_id text,
  p_participant_ids text[]
)
RETURNS TABLE (
  removed_count integer,
  failed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_removed_count INTEGER := 0;
  v_user_id TEXT;
  v_rows_affected INTEGER;
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  -- Verify caller is group owner or admin
  IF NOT EXISTS (
    SELECT 1 FROM groups WHERE id = p_group_id AND organizer_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM group_admins WHERE group_id = p_group_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you are not an owner or admin of this group'
      USING ERRCODE = 'P0001';
  END IF;

  -- Process each user
  FOREACH v_user_id IN ARRAY p_participant_ids
  LOOP
    DELETE FROM group_participants
    WHERE group_id = p_group_id
      AND user_id = v_user_id::uuid;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    v_removed_count := v_removed_count + v_rows_affected;
  END LOOP;

  RETURN QUERY SELECT v_removed_count, 0;
END;
$$;

-- ============================================================================
-- 6. get_group_members_with_user_info: require caller is member, owner, or admin
-- ============================================================================
CREATE OR REPLACE FUNCTION "public"."get_group_members_with_user_info"(p_group_id text)
RETURNS TABLE(user_id uuid, joined_at timestamp with time zone, email text, full_name text, avatar_url text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  -- Verify caller is group owner, admin, or member
  IF NOT EXISTS (
    SELECT 1 FROM groups WHERE id = p_group_id AND organizer_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM group_admins WHERE group_id = p_group_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM group_participants WHERE group_id = p_group_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you are not a member of this group'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    gp.user_id,
    gp.joined_at,
    u.email::text,
    (u.raw_user_meta_data->>'full_name')::text as full_name,
    (u.raw_user_meta_data->>'avatar_url')::text as avatar_url
  FROM group_participants gp
  JOIN auth.users u ON u.id = gp.user_id
  WHERE gp.group_id = p_group_id
  ORDER BY gp.joined_at DESC;
END;
$$;

-- ============================================================================
-- 7. get_event_participants_with_avatar: require caller is event organizer
-- ============================================================================
DROP FUNCTION IF EXISTS get_event_participants_with_avatar(text);

CREATE OR REPLACE FUNCTION get_event_participants_with_avatar(p_event_id text)
RETURNS TABLE (
  participant_id uuid,
  user_id uuid,
  avatar_url text,
  full_name text
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Require authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  -- Verify caller is the event organizer
  IF NOT EXISTS (
    SELECT 1 FROM events WHERE id = p_event_id AND organizer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you are not the organizer of this event'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    p.id as participant_id,
    p.user_id,
    COALESCE(
      (u.raw_user_meta_data->>'avatar_url')::text,
      (u.raw_user_meta_data->>'picture')::text
    ) as avatar_url,
    (u.raw_user_meta_data->>'full_name')::text as full_name
  FROM participants p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.event_id = p_event_id;
END;
$$;
