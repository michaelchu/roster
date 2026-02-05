import { useState, useEffect, useCallback, useRef } from 'react';
import {
  notificationService,
  pushSubscriptionService,
  notificationPreferenceService,
} from '@/services';
import { useAuth } from '@/hooks/useAuth';
import { logError } from '@/lib/errorHandler';
import type { Notification, NotificationPreferences } from '@/types/notifications';

/**
 * Hook for managing notifications and push subscriptions.
 * Provides state for notifications list, unread count, and user preferences.
 * Handles real-time notification updates and push subscription management.
 * @returns Notification state, capabilities, and action methods
 */
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  const isSupported = pushSubscriptionService.isSupported();
  const isConfigured = pushSubscriptionService.isConfigured();

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setPreferences(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [notifs, count, prefs, browserHasSubscription] = await Promise.all([
          notificationService.getNotifications(),
          notificationService.getUnreadCount(),
          notificationPreferenceService.getPreferences(),
          pushSubscriptionService.isSubscribed(),
        ]);

        if (cancelled) return;

        setNotifications(notifs);
        setUnreadCount(count);
        setPreferences(prefs);
        setPermission(pushSubscriptionService.getPermissionStatus());

        const currentPermission = pushSubscriptionService.getPermissionStatus();

        if (browserHasSubscription && currentPermission === 'granted') {
          // Auto-resubscribe: Browser has an active subscription, register it for this user.
          // This handles sign out/sign in flows seamlessly.
          try {
            await pushSubscriptionService.subscribe();
            setIsSubscribed(true);
          } catch {
            // If auto-resubscribe fails, user can still manually enable
            setIsSubscribed(false);
          }
        } else if (!browserHasSubscription && currentPermission === 'default') {
          // New user or first time on this device: request permission and subscribe.
          // This provides a seamless onboarding experience - users don't need to
          // manually enable push notifications.
          try {
            const perm = await pushSubscriptionService.requestPermission();
            setPermission(perm);
            if (perm === 'granted') {
              await pushSubscriptionService.subscribe();
              setIsSubscribed(true);
              // Also enable in database preferences
              await notificationPreferenceService.updatePreferences({ push_enabled: true });
            } else {
              setIsSubscribed(false);
            }
          } catch {
            setIsSubscribed(false);
          }
        } else {
          setIsSubscribed(false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error('Failed to load notifications'));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    unsubscribeRef.current = notificationService.subscribeToNotifications(
      user.id,
      (notification) => {
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user]);

  /** Refreshes notifications list and unread count from the server */
  const refresh = useCallback(async () => {
    if (!user) return;

    try {
      const [notifs, count] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (err) {
      logError('Failed to refresh notifications', err);
    }
  }, [user]);

  /** Requests permission and subscribes to push notifications */
  const subscribe = useCallback(async () => {
    try {
      const perm = await pushSubscriptionService.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        const subscription = await pushSubscriptionService.subscribe();
        if (subscription) {
          setIsSubscribed(true);
        }
      }

      return perm;
    } catch (err) {
      logError('Failed to subscribe to push', err);
      throw err;
    }
  }, []);

  /** Unsubscribes from push notifications */
  const unsubscribe = useCallback(async () => {
    try {
      await pushSubscriptionService.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      logError('Failed to unsubscribe from push', err);
      throw err;
    }
  }, []);

  /** Marks a single notification as read */
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      logError('Failed to mark notification as read', err, { notificationId });
      throw err;
    }
  }, []);

  /** Marks all notifications as read */
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      logError('Failed to mark all as read', err);
      throw err;
    }
  }, []);

  /** Deletes a notification and updates unread count if needed */
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        const notification = notifications.find((n) => n.id === notificationId);
        await notificationService.deleteNotification(notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        if (notification && !notification.read_at) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (err) {
        logError('Failed to delete notification', err, { notificationId });
        throw err;
      }
    },
    [notifications]
  );

  /** Updates user notification preferences */
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    try {
      const updated = await notificationPreferenceService.updatePreferences(updates);
      setPreferences(updated);
      return updated;
    } catch (err) {
      logError('Failed to update preferences', err);
      throw err;
    }
  }, []);

  return {
    notifications,
    unreadCount,
    preferences,
    isSubscribed,
    permission,
    loading,
    error,
    isSupported,
    isConfigured,
    subscribe,
    unsubscribe,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
    refresh,
  };
}
