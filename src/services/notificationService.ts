import { supabase } from '@/lib/supabase';
import type { Notification, NotificationType } from '@/types/notifications';
import { throwIfSupabaseError, requireData } from '@/lib/errorHandler';

// Note: Using type assertions because 'notifications' table types are not yet in
// the auto-generated database.types.ts. Types will be available after running
// `npx supabase gen types typescript` once the migration is applied.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Data needed to queue a notification */
interface QueueNotificationParams {
  recipientUserId: string;
  notificationType: NotificationType;
  title: string;
  body: string;
  eventId?: string | null;
  participantId?: string | null;
  actorUserId?: string | null;
  actionUrl?: string | null;
}

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

    return (throwIfSupabaseError({ data, error }) || []) as Notification[];
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    const { count, error } = await (supabase as any)
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .is('read_at', null);

    throwIfSupabaseError({ data: count, error });
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
    const { data, error } = await (supabase as any)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    throwIfSupabaseError({ data, error });
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    const { data, error } = await (supabase as any)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);

    throwIfSupabaseError({ data, error });
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const { data, error } = await (supabase as any)
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    throwIfSupabaseError({ data, error });
  },

  /**
   * Create a notification in the inbox for the current user
   */
  async createNotification(notification: {
    type: string;
    title: string;
    body: string;
    event_id?: string | null;
    action_url?: string | null;
  }): Promise<Notification> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await (supabase as any)
      .from('notifications')
      .insert({
        ...notification,
        recipient_user_id: user.id,
      })
      .select()
      .single();

    throwIfSupabaseError({ data, error });
    return requireData(data, 'create notification') as Notification;
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

  // ============================================================================
  // Notification Queue Functions (moved from DB triggers)
  // ============================================================================

  /**
   * Queue a notification for delivery. This inserts into notification_queue
   * which triggers the Edge Function to send the push notification.
   */
  async queueNotification(params: QueueNotificationParams): Promise<void> {
    const { error } = await (supabase as any).from('notification_queue').insert({
      recipient_user_id: params.recipientUserId,
      notification_type: params.notificationType,
      title: params.title,
      body: params.body,
      event_id: params.eventId || null,
      participant_id: params.participantId || null,
      actor_user_id: params.actorUserId || null,
      action_url: params.actionUrl || null,
    });

    // Silently ignore duplicate notifications (unique constraint violations)
    if (error && error.code !== '23505') {
      console.error('Failed to queue notification:', error);
    }
  },

  /**
   * Queue new_signup notification to organizer when someone registers
   */
  async queueNewSignup(params: {
    organizerId: string;
    eventId: string;
    eventName: string;
    participantId: string;
    participantName: string;
    actorUserId: string | null;
  }): Promise<void> {
    // Don't notify organizer if they signed up themselves
    if (params.actorUserId === params.organizerId) return;

    await this.queueNotification({
      recipientUserId: params.organizerId,
      notificationType: 'new_signup',
      title: `New signup for ${params.eventName}`,
      body: `${params.participantName} just signed up`,
      eventId: params.eventId,
      participantId: params.participantId,
      actorUserId: params.actorUserId,
      actionUrl: `/events/${params.eventId}/participants`,
    });
  },

  /**
   * Queue signup_confirmed notification to participant when they register
   */
  async queueSignupConfirmed(params: {
    participantUserId: string;
    organizerId: string;
    eventId: string;
    eventName: string;
    participantId: string;
  }): Promise<void> {
    // Don't send confirmation to organizer
    if (params.participantUserId === params.organizerId) return;

    await this.queueNotification({
      recipientUserId: params.participantUserId,
      notificationType: 'signup_confirmed',
      title: 'Signup confirmed!',
      body: `You're registered for ${params.eventName}`,
      eventId: params.eventId,
      participantId: params.participantId,
      actionUrl: `/events/${params.eventId}`,
    });
  },

  /**
   * Queue capacity_reached notification to organizer when event is full
   */
  async queueCapacityReached(params: {
    organizerId: string;
    eventId: string;
    eventName: string;
    maxParticipants: number;
  }): Promise<void> {
    await this.queueNotification({
      recipientUserId: params.organizerId,
      notificationType: 'capacity_reached',
      title: `${params.eventName} is now full!`,
      body: `Your event has reached maximum capacity (${params.maxParticipants} participants)`,
      eventId: params.eventId,
      actionUrl: `/events/${params.eventId}`,
    });
  },

  /**
   * Queue withdrawal notification to organizer when someone withdraws
   */
  async queueWithdrawal(params: {
    organizerId: string;
    eventId: string;
    eventName: string;
    participantName: string;
    actorUserId: string | null;
  }): Promise<void> {
    // Don't notify organizer if they withdrew themselves
    if (params.actorUserId === params.organizerId) return;

    await this.queueNotification({
      recipientUserId: params.organizerId,
      notificationType: 'withdrawal',
      title: `Withdrawal from ${params.eventName}`,
      body: `${params.participantName} has withdrawn`,
      eventId: params.eventId,
      actorUserId: params.actorUserId,
      actionUrl: `/events/${params.eventId}/participants`,
    });
  },

  /**
   * Queue payment_received notification to organizer
   */
  async queuePaymentReceived(params: {
    organizerId: string;
    eventId: string;
    eventName: string;
    participantId: string;
    participantName: string;
    actorUserId: string | null;
  }): Promise<void> {
    await this.queueNotification({
      recipientUserId: params.organizerId,
      notificationType: 'payment_received',
      title: 'Payment received',
      body: `${params.participantName} paid for ${params.eventName}`,
      eventId: params.eventId,
      participantId: params.participantId,
      actorUserId: params.actorUserId,
      actionUrl: `/events/${params.eventId}/participants`,
    });
  },

  /**
   * Queue event_updated notifications to all participants
   */
  async queueEventUpdated(params: {
    organizerId: string;
    eventId: string;
    eventName: string;
    changes: string[];
    participantUserIds: string[];
  }): Promise<void> {
    if (params.changes.length === 0) return;

    const changesText = params.changes.join(', ');

    for (const userId of params.participantUserIds) {
      // Don't notify organizer
      if (userId === params.organizerId) continue;

      await this.queueNotification({
        recipientUserId: userId,
        notificationType: 'event_updated',
        title: `Event updated: ${params.eventName}`,
        body: `The ${changesText} has been updated`,
        eventId: params.eventId,
        actorUserId: params.organizerId,
        actionUrl: `/events/${params.eventId}`,
      });
    }
  },

  /**
   * Queue event_cancelled notifications to all participants
   */
  async queueEventCancelled(params: {
    organizerId: string;
    eventName: string;
    participantUserIds: string[];
  }): Promise<void> {
    for (const userId of params.participantUserIds) {
      // Don't notify organizer
      if (userId === params.organizerId) continue;

      await this.queueNotification({
        recipientUserId: userId,
        notificationType: 'event_cancelled',
        title: `Event cancelled: ${params.eventName}`,
        body: `The event "${params.eventName}" has been cancelled`,
        eventId: null,
        actorUserId: params.organizerId,
        actionUrl: '/events',
      });
    }
  },
};
