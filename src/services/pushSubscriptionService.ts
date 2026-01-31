import { supabase } from '@/lib/supabase';
import type { PushSubscription } from '@/types/notifications';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Convert a base64 string to Uint8Array for Web Push
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushSubscriptionService = {
  /**
   * Check if push notifications are supported in this browser
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  /**
   * Get current notification permission status
   */
  getPermissionStatus(): NotificationPermission {
    if (!('Notification' in window)) return 'denied';
    return Notification.permission;
  },

  /**
   * Request notification permission from the user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) return 'denied';
    const permission = await Notification.requestPermission();
    return permission;
  },

  /**
   * Check if VAPID key is configured
   */
  isConfigured(): boolean {
    return !!VAPID_PUBLIC_KEY;
  },

  /**
   * Subscribe to push notifications
   * Returns the subscription or null if failed
   */
  async subscribe(): Promise<PushSubscriptionJSON | null> {
    if (!this.isSupported()) {
      console.warn('Push notifications not supported');
      return null;
    }

    if (!VAPID_PUBLIC_KEY) {
      console.warn('VAPID public key not configured');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subscriptionJson = subscription.toJSON();

      // Save to database
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          endpoint: subscriptionJson.endpoint!,
          p256dh_key: subscriptionJson.keys?.p256dh || '',
          auth_key: subscriptionJson.keys?.auth || '',
          user_agent: navigator.userAgent,
          active: true,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: 'endpoint',
        }
      );

      if (error) throw error;

      return subscriptionJson;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw error;
    }
  },

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from database
        await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);

        // Unsubscribe from browser
        await subscription.unsubscribe();
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw error;
    }
  },

  /**
   * Check if currently subscribed to push notifications
   */
  async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return subscription !== null;
    } catch {
      return false;
    }
  },

  /**
   * Get all push subscriptions for the current user
   */
  async getSubscriptions(): Promise<PushSubscription[]> {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Deactivate a specific subscription (e.g., for another device)
   */
  async deactivateSubscription(subscriptionId: string): Promise<void> {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ active: false })
      .eq('id', subscriptionId);

    if (error) throw error;
  },
};
