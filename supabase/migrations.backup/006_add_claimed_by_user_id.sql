-- Add claimed_by_user_id field to track who claimed a spot for someone else
-- This allows us to distinguish between actual users and claimed guests

-- Add the claimed_by_user_id column
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add an index for efficient queries
CREATE INDEX IF NOT EXISTS idx_participants_claimed_by_user
ON participants(claimed_by_user_id)
WHERE claimed_by_user_id IS NOT NULL;

-- Add a comment explaining the field
COMMENT ON COLUMN participants.claimed_by_user_id IS
'References the user who claimed this spot for someone else. NULL if the participant registered themselves.';