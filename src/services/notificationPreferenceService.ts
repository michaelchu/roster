import { supabase } from '@/lib/supabase';
import type { NotificationPreferences, NotificationPreferencesInput } from '@/types/notifications';
import { throwIfSupabaseError, requireData } from '@/lib/errorHandler';

// Note: Using type assertions because 'notification_preferences' table types are not yet in
// the auto-generated database.types.ts. Types will be available after running
// `npx supabase gen types typescript` once the migration is applied.
/* eslint-disable @typescript-eslint/no-explicit-any */

// Default preferences for new users
const DEFAULT_PREFERENCES: Omit<
  NotificationPreferences,
  'id' | 'user_id' | 'created_at' | 'updated_at'
> = {
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
   * Returns null if none exist
   */
  async getPreferences(): Promise<NotificationPreferences | null> {
    const { data, error } = await (supabase as any)
      .from('notification_preferences')
      .select('*')
      .single();

    // PGRST116 = no rows returned
    if (error && error.code !== 'PGRST116') throw error;
    return data as NotificationPreferences | null;
  },

  /**
   * Get preferences with defaults applied
   * Creates preferences if they don't exist
   */
  async getOrCreatePreferences(): Promise<NotificationPreferences> {
    const existing = await this.getPreferences();
    if (existing) return existing;

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Create default preferences
    const { data, error } = await (supabase as any)
      .from('notification_preferences')
      .insert({
        user_id: user.id,
        ...DEFAULT_PREFERENCES,
      })
      .select()
      .single();

    // Handle race condition: if another request already created preferences,
    // fetch and return the existing row
    if (error?.code === '23505') {
      const existingAfterRace = await this.getPreferences();
      if (existingAfterRace) return existingAfterRace;
      throw requireData(null, 'get notification preferences after race condition');
    }

    throwIfSupabaseError({ data, error });
    return requireData(data, 'create notification preferences') as NotificationPreferences;
  },

  /**
   * Update notification preferences
   */
  async updatePreferences(updates: NotificationPreferencesInput): Promise<NotificationPreferences> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase as any)
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

    throwIfSupabaseError({ data, error });
    return requireData(data, 'update notification preferences') as NotificationPreferences;
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
