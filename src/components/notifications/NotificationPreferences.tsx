import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { logError } from '@/lib/errorHandler';
import type { NotificationPreferences as NotificationPreferencesType } from '@/types/notifications';
import { Bell, BellOff } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

type PreferenceKey = keyof Omit<
  NotificationPreferencesType,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

interface NotificationToggle {
  key: PreferenceKey;
  label: string;
}

const ORGANIZER_NOTIFICATIONS: NotificationToggle[] = [
  { key: 'notify_new_signup', label: 'New signups' },
  { key: 'notify_withdrawal', label: 'Withdrawals' },
  { key: 'notify_payment_received', label: 'Payments received' },
  { key: 'notify_capacity_reached', label: 'Capacity reached' },
];

const PARTICIPANT_NOTIFICATIONS: NotificationToggle[] = [
  { key: 'notify_signup_confirmed', label: 'Signup confirmation' },
  { key: 'notify_event_updated', label: 'Event updates' },
  { key: 'notify_event_cancelled', label: 'Event cancellations' },
  { key: 'notify_payment_reminder', label: 'Payment reminders' },
  { key: 'notify_waitlist_promotion', label: 'Waitlist updates' },
];

export function NotificationPreferences() {
  const [updating, setUpdating] = useState<PreferenceKey | null>(null);
  const {
    isSubscribed: hookIsSubscribed,
    permission,
    isSupported,
    loading,
    preferences: hookPreferences,
    subscribe: subscribeToPush,
    unsubscribe: unsubscribeFromPush,
    updatePreferences: updateHookPreferences,
    refreshSubscriptionState,
  } = useNotifications();

  // Refresh subscription state on mount to ensure fresh state after navigation
  useEffect(() => {
    refreshSubscriptionState();
  }, [refreshSubscriptionState]);

  // Track local optimistic state for both preferences and subscription
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferencesType | null>(
    null
  );
  const [localIsSubscribed, setLocalIsSubscribed] = useState<boolean | null>(null);

  // Sync local state when hook state changes
  useEffect(() => {
    if (hookPreferences) {
      setLocalPreferences(hookPreferences);
    }
  }, [hookPreferences]);

  useEffect(() => {
    setLocalIsSubscribed(hookIsSubscribed);
  }, [hookIsSubscribed]);

  // Use local state for display (allows optimistic updates)
  const preferences = localPreferences;
  const isSubscribed = localIsSubscribed ?? hookIsSubscribed;

  const handlePushToggle = async (enabled: boolean) => {
    if (!preferences) return;

    setUpdating('push_enabled');
    const previousPrefValue = preferences.push_enabled;
    const previousSubValue = isSubscribed;

    // Optimistic update for both preference and subscription state
    setLocalPreferences({ ...preferences, push_enabled: enabled });
    setLocalIsSubscribed(enabled);

    try {
      if (enabled) {
        // Subscribe to push notifications (handles permission request if needed)
        const perm = await subscribeToPush();
        if (perm !== 'granted') {
          // User denied permission, revert
          setLocalPreferences({ ...preferences, push_enabled: false });
          setLocalIsSubscribed(false);
          return;
        }
      } else {
        // Unsubscribe from push notifications
        await unsubscribeFromPush();
      }

      // Update database preference (also updates hook state)
      await updateHookPreferences({ push_enabled: enabled });
    } catch (error) {
      // Revert on error
      setLocalPreferences({ ...preferences, push_enabled: previousPrefValue });
      setLocalIsSubscribed(previousSubValue);
      logError('Failed to toggle push notifications', error);
    } finally {
      setUpdating(null);
    }
  };

  const handleToggle = async (key: PreferenceKey, enabled: boolean) => {
    if (!preferences) return;

    // Handle push_enabled separately since it needs to manage the actual subscription
    if (key === 'push_enabled') {
      return handlePushToggle(enabled);
    }

    setUpdating(key);
    const previousValue = preferences[key];

    // Optimistic update
    setLocalPreferences({ ...preferences, [key]: enabled });

    try {
      await updateHookPreferences({ [key]: enabled });
    } catch (error) {
      // Revert on error
      setLocalPreferences({ ...preferences, [key]: previousValue });
      logError('Failed to update notification preference', error, { key });
    } finally {
      setUpdating(null);
    }
  };

  // Determine the actual push state - subscribed in browser AND database preference enabled
  const isPushEnabled = isSubscribed && preferences?.push_enabled;

  // Wait for hook state (preferences and isSubscribed) to load
  if (loading) {
    return (
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="p-3 border-b bg-muted">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="p-3 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!preferences) return null;

  // Show helper text based on state
  const getHelperText = () => {
    if (!isSupported) {
      return 'Push notifications are not supported in this browser.';
    }
    if (permission === 'denied') {
      return 'Notifications are blocked. Please enable them in your browser settings.';
    }
    if (isPushEnabled) {
      return 'You will receive push notifications for the events you choose below.';
    }
    return null;
  };

  const helperText = getHelperText();
  const isDisabled = !isSupported || permission === 'denied' || updating === 'push_enabled';

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="p-3 border-b bg-muted">
        <h3 className="text-sm font-medium">Notifications</h3>
      </div>

      <div className="divide-y">
        {/* Master toggle */}
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isPushEnabled ? (
                <Bell className="h-5 w-5 text-muted-foreground" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <Label htmlFor="push-enabled" className="text-sm font-medium">
                Push notifications
              </Label>
            </div>
            <Switch
              id="push-enabled"
              checked={isPushEnabled}
              onCheckedChange={(checked) => handleToggle('push_enabled', checked)}
              disabled={isDisabled}
            />
          </div>
          {helperText && <p className="text-xs text-muted-foreground mt-2 ml-8">{helperText}</p>}
        </div>

        {isPushEnabled && (
          <>
            {/* Organizer notifications */}
            <div className="p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                As an organizer
              </p>
              <div className="space-y-3">
                {ORGANIZER_NOTIFICATIONS.map((toggle) => (
                  <div key={toggle.key} className="flex items-center justify-between">
                    <Label htmlFor={toggle.key} className="text-sm">
                      {toggle.label}
                    </Label>
                    <Switch
                      id={toggle.key}
                      checked={preferences[toggle.key] as boolean}
                      onCheckedChange={(checked) => handleToggle(toggle.key, checked)}
                      disabled={updating === toggle.key}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Participant notifications */}
            <div className="p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                As a participant
              </p>
              <div className="space-y-3">
                {PARTICIPANT_NOTIFICATIONS.map((toggle) => (
                  <div key={toggle.key} className="flex items-center justify-between">
                    <Label htmlFor={toggle.key} className="text-sm">
                      {toggle.label}
                    </Label>
                    <Switch
                      id={toggle.key}
                      checked={preferences[toggle.key] as boolean}
                      onCheckedChange={(checked) => handleToggle(toggle.key, checked)}
                      disabled={updating === toggle.key}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
