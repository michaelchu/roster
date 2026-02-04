import { useState, useEffect } from 'react';
import { UserPlus, UserX, DollarSign, Edit, Tag, Clock } from 'lucide-react';
import { participantActivityService, type ParticipantActivity } from '@/services';
import { Skeleton } from '@/components/ui/skeleton';

interface EventActivityTimelineProps {
  eventId: string;
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  joined: UserPlus,
  withdrew: UserX,
  payment_updated: DollarSign,
  info_updated: Edit,
  label_added: Tag,
  label_removed: Tag,
};

const activityColors: Record<string, string> = {
  joined: 'text-green-600 bg-green-100',
  withdrew: 'text-red-600 bg-red-100',
  payment_updated: 'text-blue-600 bg-blue-100',
  info_updated: 'text-gray-600 bg-gray-100',
  label_added: 'text-orange-600 bg-orange-100',
  label_removed: 'text-orange-600 bg-orange-100',
};

export function EventActivityTimeline({ eventId }: EventActivityTimelineProps) {
  const [activities, setActivities] = useState<ParticipantActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await participantActivityService.getEventActivity(eventId);
      setActivities(data);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatActivityMessage = (activity: ParticipantActivity): string => {
    const details = activity.details as Record<string, unknown>;
    const name = activity.participant_name;

    switch (activity.activity_type) {
      case 'joined':
        return `${name} joined${details.slot_number ? ` as #${details.slot_number}` : ''}`;
      case 'withdrew':
        return `${name} withdrew`;
      case 'payment_updated': {
        const from = details.from as string;
        const to = details.to as string;
        return `${name} payment: ${from} → ${to}`;
      }
      case 'info_updated':
        return `${name} updated their info`;
      case 'label_added':
        return `${name} labeled "${details.label_name}"`;
      case 'label_removed':
        return `${name} unlabeled "${details.label_name}"`;
      default:
        return `${name}: activity recorded`;
    }
  };

  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return diffMins <= 1 ? 'just now' : `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return time.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-3 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-6 text-center">
        <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No activity recorded yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {activities.map((activity) => {
        const Icon = activityIcons[activity.activity_type] || Clock;
        const colorClass = activityColors[activity.activity_type] || 'text-gray-600 bg-gray-100';

        return (
          <div key={activity.id} className="px-3 py-2 flex gap-3">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{formatActivityMessage(activity)}</p>
              <p className="text-xs text-muted-foreground">
                {formatRelativeTime(activity.created_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
