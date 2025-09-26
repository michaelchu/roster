-- Add notes column to participants table
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN participants.notes IS 'Optional notes or comments from the participant for this specific event registration';
