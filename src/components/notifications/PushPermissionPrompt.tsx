import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PushPermissionPromptProps {
  permission: NotificationPermission;
  isSupported: boolean;
  isConfigured: boolean;
  onEnable: () => void;
  loading?: boolean;
  className?: string;
}

export function PushPermissionPrompt({
  permission,
  isSupported,
  isConfigured,
  onEnable,
  loading,
  className,
}: PushPermissionPromptProps) {
  // Don't show if not supported or permission already granted
  if (!isSupported || permission === 'granted') {
    return null;
  }

  // Don't show if VAPID key not configured
  if (!isConfigured) {
    return null;
  }

  // If permission was denied, show a different message
  if (permission === 'denied') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border',
          className
        )}
      >
        <BellOff className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Notifications blocked</p>
          <p className="text-xs text-muted-foreground">
            Enable notifications in your browser settings to receive updates.
          </p>
        </div>
      </div>
    );
  }

  // Default prompt
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20',
        className
      )}
    >
      <Bell className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium">Enable notifications</p>
        <p className="text-xs text-muted-foreground">
          Get notified about signups, event updates, and more.
        </p>
      </div>
      <Button size="sm" onClick={onEnable} disabled={loading}>
        {loading ? 'Enabling...' : 'Enable'}
      </Button>
    </div>
  );
}
