import { supabase } from '@/lib/supabase';
import type { NotificationPreferences, NotificationPreferencesInput } from '@/types/notifications';

// Default preferences for new users
const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  push_enabled: true,
  notify_new_signup: true,
  notify_withdrawal: true,
  notify_payment_received: true,
  notify_capacity_reached: true,
  notify_signup_confirmed: true,
  notify_event_updated: true,
  notify_event_cancelled: true,
  notify_payment_reminder: true,
  notify_waitlist_promotion: true,
};

export const notificationPreferenceService = {
  /**
   * Get user's notification preferences
   * Returns default preferences if none exist
   */
  async getPreferences(): Promise<NotificationPreferences | null> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .single();

    // PGRST116 = no rows returned
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  /**
   * Get preferences with defaults applied
   * Creates preferences if they don't exist
   */
  async getOrCreatePreferences(): Promise<NotificationPreferences> {
    const existing = await this.getPreferences();
    if (existing) return existing;

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create default preferences
    const { data, error } = await supabase
      .from('notification_preferences')
      .insert({
        user_id: user.id,
        ...DEFAULT_PREFERENCES,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create notification preferences');

    return data;
  },

  /**
   * Update notification preferences
   */
  async updatePreferences(updates: NotificationPreferencesInput): Promise<NotificationPreferences> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to update notification preferences');

    return data;
  },

  /**
   * Toggle a specific notification type
   */
  async toggleNotificationType(
    type: keyof NotificationPreferencesInput,
    enabled: boolean
  ): Promise<NotificationPreferences> {
    return this.updatePreferences({ [type]: enabled });
  },

  /**
   * Enable all notifications
   */
  async enableAll(): Promise<NotificationPreferences> {
    return this.updatePreferences({
      push_enabled: true,
      notify_new_signup: true,
      notify_withdrawal: true,
      notify_payment_received: true,
      notify_capacity_reached: true,
      notify_signup_confirmed: true,
      notify_event_updated: true,
      notify_event_cancelled: true,
      notify_payment_reminder: true,
      notify_waitlist_promotion: true,
    });
  },

  /**
   * Disable all notifications (master toggle)
   */
  async disableAll(): Promise<NotificationPreferences> {
    return this.updatePreferences({ push_enabled: false });
  },
};
