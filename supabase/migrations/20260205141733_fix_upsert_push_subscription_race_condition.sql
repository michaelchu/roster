-- Fix race condition in upsert_push_subscription function
-- The previous DELETE + INSERT pattern could fail with duplicate key errors
-- when two requests came in simultaneously. Using INSERT ... ON CONFLICT
-- handles this atomically.

CREATE OR REPLACE FUNCTION upsert_push_subscription(
  p_endpoint TEXT,
  p_p256dh_key TEXT,
  p_auth_key TEXT,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_subscription_id uuid;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- First, delete any subscription with this endpoint that belongs to a DIFFERENT user
  -- (handles account switching on same device)
  DELETE FROM push_subscriptions
  WHERE endpoint = p_endpoint AND user_id != v_user_id;

  -- Now upsert for the current user - if endpoint exists for this user, update it
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, user_agent, active, last_used_at)
  VALUES (v_user_id, p_endpoint, p_p256dh_key, p_auth_key, p_user_agent, true, NOW())
  ON CONFLICT (endpoint) DO UPDATE SET
    p256dh_key = EXCLUDED.p256dh_key,
    auth_key = EXCLUDED.auth_key,
    user_agent = EXCLUDED.user_agent,
    active = true,
    last_used_at = NOW()
  RETURNING id INTO v_subscription_id;

  RETURN v_subscription_id;
END;
$$;
