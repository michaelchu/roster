import { supabase } from '@/lib/supabase';
import type { PushSubscription } from '@/types/notifications';

// Note: Using type assertions because 'push_subscriptions' table types are not yet in
// the auto-generated database.types.ts. Types will be available after running
// `npx supabase gen types typescript` once the migration is applied.
/* eslint-disable @typescript-eslint/no-explicit-any */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * Validate that a string is a valid URL-safe base64 encoded VAPID key
 * VAPID public keys should be 65 bytes when decoded (uncompressed P-256 point)
 */
function isValidVapidKey(key: string | undefined): key is string {
  if (!key || typeof key !== 'string') return false;

  // VAPID public key should be ~88 characters in base64
  if (key.length < 80 || key.length > 100) return false;

  // Check for valid URL-safe base64 characters
  const urlSafeBase64Regex = /^[A-Za-z0-9_-]+$/;
  return urlSafeBase64Regex.test(key);
}

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

/**
 * Store VAPID public key in IndexedDB for service worker access
 */
async function storeVapidKeyForServiceWorker(vapidKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('push-config', 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('config', 'readwrite');
      const store = tx.objectStore('config');
      store.put(vapidKey, 'vapidPublicKey');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
  });
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
   * Check if VAPID key is properly configured
   */
  isConfigured(): boolean {
    return isValidVapidKey(VAPID_PUBLIC_KEY);
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

    if (!isValidVapidKey(VAPID_PUBLIC_KEY)) {
      console.warn('VAPID public key not configured or invalid');
      return null;
    }

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        throw new Error('No service worker registered. Please refresh the page.');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subscriptionJson = subscription.toJSON();

      // Store VAPID key for service worker re-subscription
      await storeVapidKeyForServiceWorker(VAPID_PUBLIC_KEY);

      // Save to database
      const { error } = await (supabase as any).from('push_subscriptions').upsert(
        {
          user_id: user.id,
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
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;

      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Remove from database
        await (supabase as any)
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);

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
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return false;
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
    const { data, error } = await (supabase as any)
      .from('push_subscriptions')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as PushSubscription[];
  },

  /**
   * Deactivate a specific subscription (e.g., for another device)
   */
  async deactivateSubscription(subscriptionId: string): Promise<void> {
    const { error } = await (supabase as any)
      .from('push_subscriptions')
      .update({ active: false })
      .eq('id', subscriptionId);

    if (error) throw error;
  },
};
