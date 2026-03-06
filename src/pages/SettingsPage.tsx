import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
import { useFeatureFlag, useFeatureFlags } from '@/hooks/useFeatureFlags';
import { User, LogOut, Settings, Eye, Palette, Type, Minus, Plus } from 'lucide-react';
import { getUserDisplayName } from '@/lib/utils';
import { TopNav } from '@/components/TopNav';
import { MobileOnly } from '@/components/MobileOnly';
import { UserAvatar } from '@/components/UserAvatar';
import { SettingsPageSkeleton } from '@/components/SettingsPageSkeleton';
import { NotificationDebugPanel } from '@/components/notifications/NotificationDebugPanel';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { AdminUserSearch } from '@/components/AdminUserSearch';

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
  const { user, signOut, loading, isAdmin } = useAuth();
  const { fontSize, setFontSize } = useFontSize();
  const { theme, setTheme } = useTheme();
  const eventPrivacyEnabled = useFeatureFlag('event_privacy');
  const { isFeatureEnabled } = useFeatureFlags();
  const debugNotificationsEnabled = isFeatureEnabled('debug_notifications');
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

  return (
    <MobileOnly>
      <div className="min-h-screen bg-background pb-14">
        <TopNav sticky />

        <div className="p-3 space-y-3">
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <div className="flex items-center gap-3">
                <UserAvatar
                  name={getUserDisplayName(user, '')}
                  avatarUrl={user.user_metadata?.avatar_url || user.user_metadata?.picture}
                  size="md"
                  showIcon={!getUserDisplayName(user, '')}
                />
                <div>
                  <div className="text-sm font-medium">{getUserDisplayName(user)}</div>
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

          {isAdmin && <AdminUserSearch />}

          {debugNotificationsEnabled && <NotificationDebugPanel />}

          <NotificationPreferences />

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

              {eventPrivacyEnabled && (
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
              )}
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

          <div className="text-center text-xs text-muted-foreground py-2">
            Version {__APP_VERSION__}
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
