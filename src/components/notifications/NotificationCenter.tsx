import { useState, useEffect } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationBadge } from './NotificationBadge';
import { NotificationItem } from './NotificationItem';
import { PushPermissionPrompt } from './PushPermissionPrompt';
import { useNotifications } from '@/hooks/useNotifications';
import { errorHandler } from '@/lib/errorHandler';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const {
    notifications,
    unreadCount,
    permission,
    isSupported,
    isConfigured,
    isSubscribed,
    loading,
    subscribe,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Auto-subscribe if permission is granted but no subscription exists
  useEffect(() => {
    const autoSubscribe = async () => {
      if (
        permission === 'granted' &&
        isSupported &&
        isConfigured &&
        !isSubscribed &&
        !subscribing
      ) {
        setSubscribing(true);
        try {
          await subscribe();
        } catch (error) {
          console.error('Auto-subscribe failed:', error);
        } finally {
          setSubscribing(false);
        }
      }
    };
    autoSubscribe();
  }, [permission, isSupported, isConfigured, isSubscribed, subscribing, subscribe]);

  const handleEnableNotifications = async () => {
    setSubscribing(true);
    try {
      const result = await subscribe();
      if (result === 'granted') {
        errorHandler.success('Push notifications enabled');
      } else if (result === 'denied') {
        errorHandler.handle(
          new Error('Notification permission denied. Please enable in browser settings.')
        );
      }
    } catch (error) {
      errorHandler.handle(error, { action: 'enable notifications' });
    } finally {
      setSubscribing(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      errorHandler.handle(error, { action: 'mark all notifications read' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
    } catch (error) {
      errorHandler.handle(error, { action: 'delete notification' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative [&_svg]:size-5', className)}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell />
          <NotificationBadge count={unreadCount} />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="px-4 py-3 border-b pr-12">
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-8 text-xs">
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex flex-col h-[calc(100vh-60px)]">
          {/* Push permission prompt */}
          <PushPermissionPrompt
            permission={permission}
            isSupported={isSupported}
            isConfigured={isConfigured}
            onEnable={handleEnableNotifications}
            loading={subscribing}
            className="m-3"
          />

          {/* Notifications list */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  We'll notify you about signups, event updates, and more.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={markAsRead}
                    onDelete={handleDelete}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
