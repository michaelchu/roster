-- Add optional user_id to participants table for authenticated users
ALTER TABLE participants ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX idx_participants_user ON participants(user_id);

-- Update RLS policies to allow users to see their own participations
CREATE POLICY "Users can view own participations" ON participants
  FOR SELECT USING (auth.uid() = user_id);

-- Allow organizers to see all participants for their events (existing policy covers this)