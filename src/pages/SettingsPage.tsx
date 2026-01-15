import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
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
import {
  User,
  LogOut,
  Mail,
  MessageSquare,
  Settings,
  Eye,
  Palette,
  Type,
  Minus,
  Plus,
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { MobileOnly } from '@/components/MobileOnly';
import { SettingsPageSkeleton } from '@/components/SettingsPageSkeleton';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut, loading } = useAuth();
  const { fontSize, setFontSize } = useFontSize();
  const { theme, setTheme } = useTheme();
  const notificationsEnabled = useFeatureFlag('notifications');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [defaultCapacity, setDefaultCapacity] = useState('10');
  const [defaultVisibility, setDefaultVisibility] = useState('public');

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
        <TopNav title="Settings" sticky />

        <div className="p-3 space-y-3">
          <div className="bg-card rounded-lg border overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
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
                <h3 className="text-sm font-medium">Notifications</h3>
              </div>

              <div className="divide-y">
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <Label
                      htmlFor="email-notifications"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Email Notifications
                    </Label>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>

                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    <Label
                      htmlFor="sms-notifications"
                      className="text-sm font-medium cursor-pointer"
                    >
                      SMS Notifications
                    </Label>
                  </div>
                  <Switch
                    id="sms-notifications"
                    checked={smsNotifications}
                    onCheckedChange={setSmsNotifications}
                  />
                </div>
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
                  <Label htmlFor="default-capacity" className="text-sm font-medium">
                    Default Event Capacity
                  </Label>
                </div>
                <Input
                  id="default-capacity"
                  type="number"
                  value={defaultCapacity}
                  onChange={(e) => setDefaultCapacity(e.target.value)}
                  placeholder="10"
                  min="1"
                  max="100"
                  className="text-sm"
                />
              </div>

              <div className="p-3">
                <div className="flex items-center gap-3 mb-2">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  <Label htmlFor="default-visibility" className="text-sm font-medium">
                    Default Event Visibility
                  </Label>
                </div>
                <Select value={defaultVisibility} onValueChange={setDefaultVisibility}>
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

          <Button variant="destructive" className="w-full" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </MobileOnly>
  );
}
