import { useState, useEffect } from 'react';
import { UserPlus, UserX, DollarSign, Edit, Tag, Clock } from 'lucide-react';
import { participantActivityService, type ParticipantActivity } from '@/services';
import { logError } from '@/lib/errorHandler';
import { formatTimeAgo } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface EventActivityTimelineProps {
  eventId: string;
  refreshKey?: number;
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

export function EventActivityTimeline({ eventId, refreshKey }: EventActivityTimelineProps) {
  const [activities, setActivities] = useState<ParticipantActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, [eventId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadActivities = async () => {
    try {
      setLoading(true);
      const data = await participantActivityService.getEventActivity(eventId);
      setActivities(data);
    } catch (error) {
      logError('Failed to load activities', error, { eventId });
    } finally {
      setLoading(false);
    }
  };

  const formatActivityMessage = (activity: ParticipantActivity): string => {
    const details = activity.details as Record<string, unknown>;
    const name = activity.participant_name;

    switch (activity.activity_type) {
      case 'joined':
        return `${name} joined`;
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

  if (loading) {
    return (
      <div className="p-4">
        {[1, 2, 3, 4, 5].map((i, index) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
              {index < 4 && <div className="flex-1 w-0.5 bg-muted mt-1" />}
            </div>
            <div className="flex-1 pb-4">
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
    <div className="p-4">
      {activities.map((activity, index) => {
        const Icon = activityIcons[activity.activity_type] || Clock;
        const colorClass = activityColors[activity.activity_type] || 'text-gray-600 bg-gray-100';
        const isLast = index === activities.length - 1;

        return (
          <div key={activity.id} className="flex gap-3">
            {/* Timeline: icon + connecting line */}
            <div className="flex flex-col items-center">
              <div
                className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}
              >
                <Icon className="h-3 w-3" />
              </div>
              {!isLast && <div className="flex-1 w-0.5 bg-muted mt-1" />}
            </div>
            {/* Content */}
            <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-4'}`}>
              <p className="text-xs">
                <span className="font-medium">{formatActivityMessage(activity)}</span>
                {activity.activity_type === 'payment_updated' ? (
                  <span className="block text-muted-foreground">
                    {formatTimeAgo(activity.created_at)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    {' '}
                    · {formatTimeAgo(activity.created_at)}
                  </span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
