import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { errorHandler } from '@/lib/errorHandler';
import { toast } from 'sonner';
import { eventService, type Event } from '@/services/eventService';
import { pushSubscriptionService } from '@/services';
import type { NotificationType } from '@/types/notifications';
import { Bug, Send, RefreshCw } from 'lucide-react';

const NOTIFICATION_TYPES: { value: NotificationType; label: string; description: string }[] = [
  { value: 'new_signup', label: 'New Signup', description: 'Organizer: Someone signed up' },
  { value: 'withdrawal', label: 'Withdrawal', description: 'Organizer: Someone withdrew' },
  {
    value: 'payment_received',
    label: 'Payment Received',
    description: 'Organizer: Payment confirmed',
  },
  {
    value: 'capacity_reached',
    label: 'Capacity Reached',
    description: 'Organizer: Event is full',
  },
  {
    value: 'signup_confirmed',
    label: 'Signup Confirmed',
    description: 'Participant: Registration confirmed',
  },
  {
    value: 'event_updated',
    label: 'Event Updated',
    description: 'Participant: Event details changed',
  },
  {
    value: 'event_cancelled',
    label: 'Event Cancelled',
    description: 'Participant: Event was cancelled',
  },
  {
    value: 'payment_reminder',
    label: 'Payment Reminder',
    description: 'Participant: Payment still due',
  },
  {
    value: 'waitlist_promotion',
    label: 'Waitlist Promotion',
    description: 'Participant: Moved off waitlist',
  },
];

function getNotificationContent(type: NotificationType, eventName: string) {
  const contents: Record<NotificationType, { title: string; body: string }> = {
    new_signup: {
      title: 'New Signup!',
      body: `Someone just signed up for ${eventName}`,
    },
    withdrawal: {
      title: 'Participant Withdrew',
      body: `Someone withdrew from ${eventName}`,
    },
    payment_received: {
      title: 'Payment Received',
      body: `Payment confirmed for ${eventName}`,
    },
    capacity_reached: {
      title: 'Event Full!',
      body: `${eventName} has reached maximum capacity`,
    },
    signup_confirmed: {
      title: 'Signup Confirmed',
      body: `You're registered for ${eventName}`,
    },
    event_updated: {
      title: 'Event Updated',
      body: `${eventName} details have changed`,
    },
    event_cancelled: {
      title: 'Event Cancelled',
      body: `${eventName} has been cancelled`,
    },
    payment_reminder: {
      title: 'Payment Reminder',
      body: `Don't forget to pay for ${eventName}`,
    },
    waitlist_promotion: {
      title: "You're In!",
      body: `A spot opened up for ${eventName}`,
    },
  };
  return contents[type];
}

export function NotificationDebugPanel() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedType, setSelectedType] = useState<NotificationType | ''>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    async function loadEvents() {
      if (!user) return;
      try {
        const organizerEvents = await eventService.getEventsByOrganizer(user.id);
        setEvents(organizerEvents);
      } catch (error) {
        console.error('Failed to load events:', error);
      } finally {
        setLoadingEvents(false);
      }
    }
    loadEvents();
  }, [user]);

  useEffect(() => {
    async function checkSubscription() {
      if (!user) return;
      try {
        const subscriptions = await pushSubscriptionService.getSubscriptions();
        setHasSubscription(subscriptions.length > 0);
      } catch (error) {
        console.error('Failed to check subscriptions:', error);
        setHasSubscription(false);
      }
    }
    checkSubscription();
  }, [user]);

  const handleSyncSubscription = async () => {
    setSyncing(true);
    try {
      // Force a fresh subscription by always calling subscribe
      // This will update/insert the subscription in the database
      await pushSubscriptionService.subscribe();
      setHasSubscription(true);
      toast.success('Push subscription synced to database');
    } catch (error) {
      console.error('Failed to sync subscription:', error);
      errorHandler.handle(error, { action: 'sync push subscription' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!user || !selectedType || !selectedEventId) {
      toast.error('Please select a notification type and event');
      return;
    }

    setSending(true);
    try {
      const selectedEvent = events.find((e) => e.id === selectedEventId);
      const eventName = selectedEvent?.name || 'Test Event';
      const content = getNotificationContent(selectedType, eventName);

      const { error } = await supabase.from('notification_queue').insert({
        recipient_user_id: user.id,
        notification_type: selectedType,
        title: `[TEST] ${content.title}`,
        body: content.body,
        event_id: selectedEventId,
        scheduled_for: new Date().toISOString(),
        status: 'pending',
      });

      if (error) throw error;

      errorHandler.success(`Queued ${selectedType} notification - check your device!`);
    } catch (error) {
      console.error('Failed to queue notification:', error);
      errorHandler.handle(error, { action: 'queue test notification' });
    } finally {
      setSending(false);
    }
  };

  const selectedTypeInfo = NOTIFICATION_TYPES.find((t) => t.value === selectedType);

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="p-3 border-b bg-muted">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-medium">Notification Debug Panel</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Test all notification types by queueing them directly
        </p>
      </div>

      <div className="p-3 space-y-3">
        <div>
          <Label htmlFor="notification-type" className="text-sm font-medium">
            Notification Type
          </Label>
          <Select
            value={selectedType}
            onValueChange={(v) => setSelectedType(v as NotificationType)}
          >
            <SelectTrigger id="notification-type" className="text-sm mt-1">
              <SelectValue placeholder="Select notification type" />
            </SelectTrigger>
            <SelectContent>
              {NOTIFICATION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTypeInfo && (
            <p className="text-xs text-muted-foreground mt-1">{selectedTypeInfo.description}</p>
          )}
        </div>

        <div>
          <Label htmlFor="event-select" className="text-sm font-medium">
            Event Context
          </Label>
          <Select
            value={selectedEventId}
            onValueChange={setSelectedEventId}
            disabled={loadingEvents}
          >
            <SelectTrigger id="event-select" className="text-sm mt-1">
              <SelectValue placeholder={loadingEvents ? 'Loading events...' : 'Select an event'} />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasSubscription === false && (
          <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs">
            <p className="text-yellow-600 dark:text-yellow-400 font-medium">
              No push subscription found in database
            </p>
            <p className="text-muted-foreground mt-1">
              Your browser may have a subscription but it's not synced. Click below to sync.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={handleSyncSubscription}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Push Subscription'}
            </Button>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleSendTestNotification}
          disabled={sending || !selectedType || !selectedEventId}
        >
          <Send className="h-4 w-4 mr-2" />
          {sending ? 'Queueing...' : 'Queue Test Notification'}
        </Button>

        <p className="text-xs text-muted-foreground">
          Note: The notification will be processed by the send-push edge function and delivered to
          your subscribed devices.
        </p>
      </div>
    </div>
  );
}
