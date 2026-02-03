-- Add INSERT policy for notifications table
-- Allows users to create notifications for themselves (e.g., test notifications)

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = recipient_user_id);
