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
  const hasLoadedRef = useRef(false);

  const isSupported = pushSubscriptionService.isSupported();
  const isConfigured = pushSubscriptionService.isConfigured();

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setPreferences(null);
      setIsSubscribed(false);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    let cancelled = false;

    const load = async () => {
      // Only show loading state on first load, not on refetches
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      setError(null);

      try {
        const [notifs, count, prefs, browserHasSubscription] = await Promise.all([
          notificationService.getNotifications(),
          notificationService.getUnreadCount(),
          notificationPreferenceService.getOrCreatePreferences(),
          pushSubscriptionService.isSubscribed(),
        ]);

        if (cancelled) return;

        setNotifications(notifs);
        setUnreadCount(count);
        setPreferences(prefs);
        setPermission(pushSubscriptionService.getPermissionStatus());

        const currentPermission = pushSubscriptionService.getPermissionStatus();

        // Set subscription state based on actual browser state
        // Don't auto-resubscribe here - let user explicitly enable via settings toggle
        if (browserHasSubscription && currentPermission === 'granted') {
          setIsSubscribed(true);
          // If browser has subscription but DB doesn't have push_enabled,
          // sync the DB to match (user previously enabled, just needs DB update)
          if (!prefs.push_enabled) {
            try {
              await pushSubscriptionService.subscribe();
              await notificationPreferenceService.updatePreferences({ push_enabled: true });
              // Update local state to reflect the sync
              if (!cancelled) {
                setPreferences({ ...prefs, push_enabled: true });
              }
            } catch {
              // If sync fails, still show as subscribed since browser has subscription
            }
          }
        } else {
          setIsSubscribed(false);
        }

        hasLoadedRef.current = true;
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

  /** Refreshes subscription state from browser - useful after navigation */
  const refreshSubscriptionState = useCallback(async () => {
    try {
      const [browserHasSubscription, prefs] = await Promise.all([
        pushSubscriptionService.isSubscribed(),
        notificationPreferenceService.getOrCreatePreferences(),
      ]);

      const currentPermission = pushSubscriptionService.getPermissionStatus();
      setPermission(currentPermission);
      setPreferences(prefs);

      if (browserHasSubscription && currentPermission === 'granted') {
        setIsSubscribed(true);
      } else {
        setIsSubscribed(false);
      }
    } catch (err) {
      logError('Failed to refresh subscription state', err);
    }
  }, []);

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
    refreshSubscriptionState,
  };
}
