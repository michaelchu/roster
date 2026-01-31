// Notification types for the push notification system

// All possible notification types
export type NotificationType =
  // Organizer notifications
  | 'new_signup'
  | 'withdrawal'
  | 'payment_received'
  | 'capacity_reached'
  // Participant notifications
  | 'signup_confirmed'
  | 'event_updated'
  | 'event_cancelled'
  | 'payment_reminder'
  | 'waitlist_promotion';

// Notification queue status
export type NotificationQueueStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';

// User notification preferences
export interface NotificationPreferences {
  id: string;
  user_id: string;

  // Master toggle
  push_enabled: boolean;

  // Organizer notification preferences
  notify_new_signup: boolean;
  notify_withdrawal: boolean;
  notify_payment_received: boolean;
  notify_capacity_reached: boolean;

  // Participant notification preferences
  notify_signup_confirmed: boolean;
  notify_event_updated: boolean;
  notify_event_cancelled: boolean;
  notify_payment_reminder: boolean;
  notify_waitlist_promotion: boolean;

  created_at: string;
  updated_at: string;
}

// Web Push subscription stored in database
export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent: string | null;
  active: boolean;
  created_at: string;
  last_used_at: string;
}

// Notification in the inbox
export interface Notification {
  id: string;
  recipient_user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  event_id: string | null;
  participant_id: string | null;
  actor_user_id: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
}

// Notification queue item (for processing)
export interface NotificationQueueItem {
  id: string;
  recipient_user_id: string;
  notification_type: NotificationType;
  title: string;
  body: string;
  event_id: string | null;
  participant_id: string | null;
  actor_user_id: string | null;
  action_url: string | null;
  scheduled_for: string;
  status: NotificationQueueStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}

// Payload for Web Push notification
export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: {
    type: NotificationType;
    url?: string;
    event_id?: string;
  };
}

// Input types for creating/updating preferences
export type NotificationPreferencesInput = Partial<
  Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>
>;
