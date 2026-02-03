-- Enable realtime for notifications table
-- This allows the notification center to update in real-time when new notifications are created

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
