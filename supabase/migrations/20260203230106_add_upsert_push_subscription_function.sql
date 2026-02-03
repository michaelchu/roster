-- Function to upsert push subscription, handling cross-user endpoint conflicts
-- When a user switches accounts on the same device, the endpoint stays the same
-- but the old subscription (belonging to the previous user) needs to be replaced
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

  -- Delete any existing subscription with this endpoint (could belong to another user)
  DELETE FROM push_subscriptions WHERE endpoint = p_endpoint;

  -- Insert the new subscription
  INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, user_agent, active, last_used_at)
  VALUES (v_user_id, p_endpoint, p_p256dh_key, p_auth_key, p_user_agent, true, NOW())
  RETURNING id INTO v_subscription_id;

  RETURN v_subscription_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION upsert_push_subscription(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Also fix the UPDATE policy to include WITH CHECK clause
DROP POLICY IF EXISTS "Users can update own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update own subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
