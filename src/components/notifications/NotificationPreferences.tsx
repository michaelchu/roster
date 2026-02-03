import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { notificationPreferenceService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';
import type { NotificationPreferences as NotificationPreferencesType } from '@/types/notifications';
import { Bell, BellOff } from 'lucide-react';

type PreferenceKey = keyof Omit<
  NotificationPreferencesType,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;

interface NotificationToggle {
  key: PreferenceKey;
  label: string;
  description: string;
}

const ORGANIZER_NOTIFICATIONS: NotificationToggle[] = [
  {
    key: 'notify_new_signup',
    label: 'New signups',
    description: 'When someone registers for your event',
  },
  {
    key: 'notify_withdrawal',
    label: 'Withdrawals',
    description: 'When someone withdraws from your event',
  },
  {
    key: 'notify_payment_received',
    label: 'Payments received',
    description: 'When a participant marks payment as complete',
  },
  {
    key: 'notify_capacity_reached',
    label: 'Capacity reached',
    description: 'When your event reaches maximum capacity',
  },
];

const PARTICIPANT_NOTIFICATIONS: NotificationToggle[] = [
  {
    key: 'notify_signup_confirmed',
    label: 'Signup confirmation',
    description: 'When you successfully register for an event',
  },
  {
    key: 'notify_event_updated',
    label: 'Event updates',
    description: 'When event details change (time, location, etc.)',
  },
  {
    key: 'notify_event_cancelled',
    label: 'Event cancellations',
    description: 'When an event you registered for is cancelled',
  },
  {
    key: 'notify_payment_reminder',
    label: 'Payment reminders',
    description: 'Reminder to pay after an event ends',
  },
  {
    key: 'notify_waitlist_promotion',
    label: 'Waitlist updates',
    description: 'When you get a spot from the waitlist',
  },
];

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferencesType | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<PreferenceKey | null>(null);

  useEffect(() => {
    async function loadPreferences() {
      try {
        const prefs = await notificationPreferenceService.getOrCreatePreferences();
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load notification preferences:', error);
        errorHandler.handle(error, { action: 'load notification preferences' });
      } finally {
        setLoading(false);
      }
    }
    loadPreferences();
  }, []);

  const handleToggle = async (key: PreferenceKey, enabled: boolean) => {
    if (!preferences) return;

    setUpdating(key);
    const previousValue = preferences[key];

    // Optimistic update
    setPreferences({ ...preferences, [key]: enabled });

    try {
      await notificationPreferenceService.toggleNotificationType(key, enabled);
    } catch (error) {
      // Revert on error
      setPreferences({ ...preferences, [key]: previousValue });
      console.error('Failed to update notification preference:', error);
      errorHandler.handle(error, { action: 'update notification preference' });
    } finally {
      setUpdating(null);
    }
  };

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

  const masterEnabled = preferences.push_enabled;

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
              {masterEnabled ? (
                <Bell className="h-5 w-5 text-muted-foreground" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="push-enabled" className="text-sm font-medium">
                  Push notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  {masterEnabled ? 'Enabled' : 'All notifications disabled'}
                </p>
              </div>
            </div>
            <Switch
              id="push-enabled"
              checked={masterEnabled}
              onCheckedChange={(checked) => handleToggle('push_enabled', checked)}
              disabled={updating === 'push_enabled'}
            />
          </div>
        </div>

        {masterEnabled && (
          <>
            {/* Organizer notifications */}
            <div className="p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                As an organizer
              </p>
              <div className="space-y-3">
                {ORGANIZER_NOTIFICATIONS.map((toggle) => (
                  <div key={toggle.key} className="flex items-center justify-between">
                    <div>
                      <Label htmlFor={toggle.key} className="text-sm">
                        {toggle.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{toggle.description}</p>
                    </div>
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
                    <div>
                      <Label htmlFor={toggle.key} className="text-sm">
                        {toggle.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{toggle.description}</p>
                    </div>
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
