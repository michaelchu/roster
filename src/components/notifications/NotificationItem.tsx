import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  UserMinus,
  Calendar,
  CalendarX,
  CreditCard,
  Users,
  Bell,
  ArrowUpCircle,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types/notifications';

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const notificationIcons: Record<NotificationType, typeof Bell> = {
  new_signup: UserPlus,
  withdrawal: UserMinus,
  payment_received: CreditCard,
  capacity_reached: Users,
  signup_confirmed: Calendar,
  event_updated: Calendar,
  event_cancelled: CalendarX,
  payment_reminder: CreditCard,
  waitlist_promotion: ArrowUpCircle,
};

const notificationColors: Record<NotificationType, string> = {
  new_signup: 'text-green-500',
  withdrawal: 'text-orange-500',
  payment_received: 'text-green-500',
  capacity_reached: 'text-blue-500',
  signup_confirmed: 'text-green-500',
  event_updated: 'text-blue-500',
  event_cancelled: 'text-destructive',
  payment_reminder: 'text-orange-500',
  waitlist_promotion: 'text-green-500',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

const SWIPE_THRESHOLD = 80;

export function NotificationItem({ notification, onRead, onDelete }: NotificationItemProps) {
  const navigate = useNavigate();
  const isUnread = !notification.read_at;
  const Icon = notificationIcons[notification.type] || Bell;
  const iconColor = notificationColors[notification.type] || 'text-muted-foreground';

  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = startXRef.current - currentXRef.current;
    // Only allow left swipe (positive diff), cap at threshold + some buffer
    const newSwipeX = Math.max(0, Math.min(diff, SWIPE_THRESHOLD + 40));
    setSwipeX(newSwipeX);
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX >= SWIPE_THRESHOLD) {
      onDelete(notification.id);
    } else {
      setSwipeX(0);
    }
  };

  const handleClick = () => {
    if (swipeX > 10) return; // Ignore click if swiping
    if (isUnread) {
      onRead(notification.id);
    }
    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete background */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-end bg-destructive transition-opacity',
          swipeX > 0 ? 'opacity-100' : 'opacity-0'
        )}
        style={{ width: Math.max(swipeX, SWIPE_THRESHOLD) }}
      >
        <Trash2 className="h-5 w-5 text-destructive-foreground mr-4" />
      </div>

      {/* Notification content */}
      <button
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={cn(
          'w-full flex items-start gap-3 p-3 text-left transition-colors bg-background',
          'hover:bg-muted/50 focus:bg-muted/50 focus:outline-none',
          isUnread && 'bg-muted/30',
          isSwiping && 'transition-none'
        )}
        style={{ transform: `translateX(-${swipeX}px)` }}
      >
        <div className={cn('flex-shrink-0 mt-0.5', iconColor)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm font-medium truncate', isUnread && 'font-semibold')}>
              {notification.title}
            </p>
            {isUnread && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{notification.body}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatTimeAgo(notification.created_at)}
          </p>
        </div>
      </button>
    </div>
  );
}
