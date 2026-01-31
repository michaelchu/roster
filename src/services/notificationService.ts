import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/notifications';

// Note: Using type assertions because 'notifications' table types are not yet in
// the auto-generated database.types.ts. Types will be available after running
// `npx supabase gen types typescript` once the migration is applied.
/* eslint-disable @typescript-eslint/no-explicit-any */

export const notificationService = {
  /**
   * Get user's notifications (inbox)
   */
  async getNotifications(limit = 50, offset = 0): Promise<Notification[]> {
    const { data, error } = await (supabase as any)
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return (data || []) as Notification[];
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    const { count, error } = await (supabase as any)
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null);

    if (error) throw error;
    return count || 0;
  },

  /**
   * Get a single notification by ID
   */
  async getNotificationById(notificationId: string): Promise<Notification | null> {
    const { data, error } = await (supabase as any)
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    // PGRST116 = no rows returned
    if (error && error.code !== 'PGRST116') throw error;
    return data as Notification | null;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) throw error;
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    const { error } = await (supabase as any)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);

    if (error) throw error;
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
  },

  /**
   * Subscribe to real-time notification updates
   */
  subscribeToNotifications(
    userId: string,
    onInsert: (notification: Notification) => void
  ): () => void {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          onInsert(payload.new as Notification);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
