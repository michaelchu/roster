-- Create function for atomic bulk payment status updates with validation
-- Returns the count of successfully updated participants

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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.bulk_update_payment_status(text[], text, text) TO authenticated;
