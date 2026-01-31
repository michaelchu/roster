import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { MaxParticipantsInput } from '@/components/MaxParticipantsInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useFontSize, type FontSize } from '@/hooks/useFontSize';
import { useTheme } from '@/components/theme-provider';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';
import { useNotifications } from '@/hooks/useNotifications';
import {
  User,
  LogOut,
  Bell,
  BellOff,
  Settings,
  Eye,
  Palette,
  Type,
  Minus,
  Plus,
  UserPlus,
  UserMinus,
  CreditCard,
  Users,
  Calendar,
  CalendarX,
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { MobileOnly } from '@/components/MobileOnly';
import { UserAvatar } from '@/components/UserAvatar';
import { SettingsPageSkeleton } from '@/components/SettingsPageSkeleton';

const STORAGE_KEYS = {
  defaultCapacity: 'settings:defaultCapacity',
  defaultVisibility: 'settings:defaultVisibility',
} as const;

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { fontSize, setFontSize } = useFontSize();
  const { theme, setTheme } = useTheme();
  const notificationsEnabled = useFeatureFlag('notifications');
  const {
    preferences,
    isSubscribed,
    permission,
    isSupported,
    isConfigured,
    subscribe,
    unsubscribe,
    updatePreferences,
    loading: notificationsLoading,
  } = useNotifications();

  const [subscribing, setSubscribing] = useState(false);
  const [defaultCapacity, setDefaultCapacity] = useState(() =>
    loadFromStorage(STORAGE_KEYS.defaultCapacity, 10)
  );
  const [defaultVisibility, setDefaultVisibility] = useState(() =>
    loadFromStorage(STORAGE_KEYS.defaultVisibility, 'public')
  );

  const fontSizeOptions: FontSize[] = ['sm', 'md', 'lg'];
  const currentFontSizeIndex = fontSizeOptions.indexOf(fontSize);

  const handleFontSizeChange = (value: number[]) => {
    const newFontSize = fontSizeOptions[value[0]];
    setFontSize(newFontSize);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleEnablePush = async () => {
    setSubscribing(true);
    try {
      await subscribe();
    } catch (error) {
      console.error('Failed to enable push:', error);
    } finally {
      setSubscribing(false);
    }
  };

  const handleDisablePush = async () => {
    setSubscribing(true);
    try {
      await unsubscribe();
      await updatePreferences({ push_enabled: false });
    } catch (error) {
      console.error('Failed to disable push:', error);
    } finally {
      setSubscribing(false);
    }
  };

  const handleTogglePreference = async (key: string, value: boolean) => {
    try {
      await updatePreferences({ [key]: value });
    } catch (error) {
      console.error('Failed to update preference:', error);
    }
  };

  if (loading) {
    return <SettingsPageSkeleton />;
  }

  if (!user) {
    return (
      <MobileOnly>
        <div className="min-h-screen bg-background pb-14 flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-lg font-semibold mb-2">Sign In Required</h1>
            <p className="text-sm text-muted-foreground mb-4">Please sign in to access settings</p>
            <Button onClick={() => navigate('/auth/login')}>Sign In</Button>
          </div>
        </div>
      </MobileOnly>
    );
  }

  const showPushSettings = isSupported && isConfigured && permission === 'granted' && isSubscribed;

  return (
    <MobileOnly>
      <div className="min-h-screen bg-background pb-14">
        <TopNav sticky />

        <div className="p-3 space-y-3">
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={user.user_metadata?.full_name}
                  avatarUrl={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                  size="md"
                  showIcon={!user.user_metadata?.full_name}
                />
                <div>
                  <div className="text-sm font-medium">
                    {user.user_metadata?.full_name || 'User'}
                  </div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
              </div>
            </div>

            <div className="divide-y">
              <button
                className="w-full p-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                onClick={() => navigate('/profile')}
              >
                <User className="h-5 w-5 text-muted-foreground" />
                <div className="text-sm font-medium">Profile</div>
              </button>
            </div>
          </div>

          {notificationsEnabled && (
            <div className="bg-card rounded-lg border overflow-hidden">
              <div className="p-3 border-b bg-muted">
                <h3 className="text-sm font-medium">Push Notifications</h3>
              </div>

              <div className="divide-y">
                {/* Push notification master toggle */}
                {!isSupported ? (
                  <div className="p-3 flex items-center gap-3 text-muted-foreground">
                    <BellOff className="h-5 w-5" />
                    <span className="text-sm">Push notifications not supported on this device</span>
                  </div>
                ) : !isConfigured ? (
                  <div className="p-3 flex items-center gap-3 text-muted-foreground">
                    <BellOff className="h-5 w-5" />
                    <span className="text-sm">Push notifications not configured</span>
                  </div>
                ) : permission === 'denied' ? (
                  <div className="p-3 flex items-center gap-3 text-muted-foreground">
                    <BellOff className="h-5 w-5" />
                    <div className="text-sm">
                      <p className="font-medium">Notifications blocked</p>
                      <p className="text-xs">Enable in browser settings</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className="h-5 w-5 text-muted-foreground" />
                      <Label htmlFor="push-enabled" className="text-sm font-medium cursor-pointer">
                        Enable Push Notifications
                      </Label>
                    </div>
                    <Switch
                      id="push-enabled"
                      checked={isSubscribed}
                      disabled={subscribing || notificationsLoading}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleEnablePush();
                        } else {
                          handleDisablePush();
                        }
                      }}
                    />
                  </div>
                )}

                {/* Notification type preferences (only show if push is enabled) */}
                {showPushSettings && preferences && (
                  <>
                    <div className="p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        As an Organizer
                      </p>
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UserPlus className="h-5 w-5 text-green-500" />
                        <Label
                          htmlFor="notify-new-signup"
                          className="text-sm font-medium cursor-pointer"
                        >
                          New Signups
                        </Label>
                      </div>
                      <Switch
                        id="notify-new-signup"
                        checked={preferences.notify_new_signup}
                        onCheckedChange={(checked) =>
                          handleTogglePreference('notify_new_signup', checked)
                        }
                      />
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <UserMinus className="h-5 w-5 text-orange-500" />
                        <Label
                          htmlFor="notify-withdrawal"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Withdrawals
                        </Label>
                      </div>
                      <Switch
                        id="notify-withdrawal"
                        checked={preferences.notify_withdrawal}
                        onCheckedChange={(checked) =>
                          handleTogglePreference('notify_withdrawal', checked)
                        }
                      />
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-green-500" />
                        <Label
                          htmlFor="notify-payment"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Payments Received
                        </Label>
                      </div>
                      <Switch
                        id="notify-payment"
                        checked={preferences.notify_payment_received}
                        onCheckedChange={(checked) =>
                          handleTogglePreference('notify_payment_received', checked)
                        }
                      />
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-blue-500" />
                        <Label
                          htmlFor="notify-capacity"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Capacity Reached
                        </Label>
                      </div>
                      <Switch
                        id="notify-capacity"
                        checked={preferences.notify_capacity_reached}
                        onCheckedChange={(checked) =>
                          handleTogglePreference('notify_capacity_reached', checked)
                        }
                      />
                    </div>

                    <div className="p-3 bg-muted/30">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                        As a Participant
                      </p>
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-green-500" />
                        <Label
                          htmlFor="notify-confirmed"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Signup Confirmed
                        </Label>
                      </div>
                      <Switch
                        id="notify-confirmed"
                        checked={preferences.notify_signup_confirmed}
                        onCheckedChange={(checked) =>
                          handleTogglePreference('notify_signup_confirmed', checked)
                        }
                      />
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-blue-500" />
                        <Label
                          htmlFor="notify-updated"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Event Updated
                        </Label>
                      </div>
                      <Switch
                        id="notify-updated"
                        checked={preferences.notify_event_updated}
                        onCheckedChange={(checked) =>
                          handleTogglePreference('notify_event_updated', checked)
                        }
                      />
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CalendarX className="h-5 w-5 text-destructive" />
                        <Label
                          htmlFor="notify-cancelled"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Event Cancelled
                        </Label>
                      </div>
                      <Switch
                        id="notify-cancelled"
                        checked={preferences.notify_event_cancelled}
                        onCheckedChange={(checked) =>
                          handleTogglePreference('notify_event_cancelled', checked)
                        }
                      />
                    </div>

                    <div className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-orange-500" />
                        <Label
                          htmlFor="notify-payment-reminder"
                          className="text-sm font-medium cursor-pointer"
                        >
                          Payment Reminders
                        </Label>
                      </div>
                      <Switch
                        id="notify-payment-reminder"
                        checked={preferences.notify_payment_reminder}
                        onCheckedChange={(checked) =>
                          handleTogglePreference('notify_payment_reminder', checked)
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <h3 className="text-sm font-medium">Event Management</h3>
            </div>

            <div className="divide-y">
              <div className="p-3">
                <div className="flex items-center gap-3 mb-2">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">Default Event Capacity</span>
                </div>
                <MaxParticipantsInput
                  value={defaultCapacity}
                  onChange={(value) => {
                    setDefaultCapacity(value);
                    saveToStorage(STORAGE_KEYS.defaultCapacity, value);
                  }}
                  label=""
                  max={100}
                />
              </div>

              <div className="p-3">
                <div className="flex items-center gap-3 mb-2">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  <Label htmlFor="default-visibility" className="text-sm font-medium">
                    Default Event Visibility
                  </Label>
                </div>
                <Select
                  value={defaultVisibility}
                  onValueChange={(value) => {
                    setDefaultVisibility(value);
                    saveToStorage(STORAGE_KEYS.defaultVisibility, value);
                  }}
                >
                  <SelectTrigger id="default-visibility" className="text-sm">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="invite-only">Invite Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <h3 className="text-sm font-medium">Appearance</h3>
            </div>

            <div className="p-3">
              <div className="flex items-center gap-3 mb-2">
                <Palette className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor="theme" className="text-sm font-medium">
                  Theme
                </Label>
              </div>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger id="theme" className="text-sm">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 border-t">
              <div className="flex items-center gap-3 mb-3">
                <Type className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor="font-size" className="text-sm font-medium">
                  Font Size
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Minus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Slider
                  id="font-size"
                  min={0}
                  max={2}
                  step={1}
                  value={[currentFontSizeIndex]}
                  onValueChange={handleFontSizeChange}
                  className="flex-1"
                />
                <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </MobileOnly>
  );
}
