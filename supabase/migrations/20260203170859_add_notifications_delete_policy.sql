-- Add DELETE policy for notifications table
-- Allows users to delete their own notifications

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = recipient_user_id);
