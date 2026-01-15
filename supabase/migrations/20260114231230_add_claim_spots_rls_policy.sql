-- Add RLS policy to allow authenticated users to claim spots for others
-- This enables the claim functionality where users can register additional participants

CREATE POLICY "Authenticated users can claim spots for others" 
ON "public"."participants" 
FOR INSERT 
WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL 
  -- The claimed_by_user_id must match the authenticated user
  AND claimed_by_user_id = auth.uid()
);

COMMENT ON POLICY "Authenticated users can claim spots for others" ON "public"."participants" 
IS 'Allows authenticated users to create participant records for others (claimed spots) where they are marked as the claimer.';
