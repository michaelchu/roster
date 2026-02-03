import { useState, useEffect, useCallback, useRef } from 'react';
import {
  notificationService,
  pushSubscriptionService,
  notificationPreferenceService,
} from '@/services';
import { useAuth } from '@/hooks/useAuth';
import type { Notification, NotificationPreferences } from '@/types/notifications';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Use ref to track subscription cleanup function
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Check push notification support and status
  const isSupported = pushSubscriptionService.isSupported();
  const isConfigured = pushSubscriptionService.isConfigured();

  // Load notifications data
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
        const [notifs, count, prefs, subscribed] = await Promise.all([
          notificationService.getNotifications(),
          notificationService.getUnreadCount(),
          notificationPreferenceService.getPreferences(),
          pushSubscriptionService.isSubscribed(),
        ]);

        if (cancelled) return;

        setNotifications(notifs);
        setUnreadCount(count);
        setPreferences(prefs);
        setIsSubscribed(subscribed);
        setPermission(pushSubscriptionService.getPermissionStatus());
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

  // Separate effect for realtime subscription to avoid race conditions
  useEffect(() => {
    if (!user) {
      return;
    }

    // Clean up any existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Subscribe to real-time updates
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

  // Refresh notifications
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
      console.error('Failed to refresh notifications:', err);
    }
  }, [user]);

  // Subscribe to push notifications
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
      console.error('Failed to subscribe to push:', err);
      throw err;
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    try {
      await pushSubscriptionService.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      console.error('Failed to unsubscribe from push:', err);
      throw err;
    }
  }, []);

  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      throw err;
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      throw err;
    }
  }, []);

  // Delete a notification
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
        console.error('Failed to delete notification:', err);
        throw err;
      }
    },
    [notifications]
  );

  // Update notification preferences
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    try {
      const updated = await notificationPreferenceService.updatePreferences(updates);
      setPreferences(updated);
      return updated;
    } catch (err) {
      console.error('Failed to update preferences:', err);
      throw err;
    }
  }, []);

  return {
    // State
    notifications,
    unreadCount,
    preferences,
    isSubscribed,
    permission,
    loading,
    error,

    // Capabilities
    isSupported,
    isConfigured,

    // Actions
    subscribe,
    unsubscribe,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
    refresh,
  };
}
