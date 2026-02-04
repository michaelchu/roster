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
  onNavigate?: () => void;
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

// Threshold to reveal delete button (snap to this position)
const REVEAL_THRESHOLD = 40;
// Width of the revealed delete button area
const REVEAL_WIDTH = 80;
// Threshold to delete immediately (drag far enough)
const IMMEDIATE_DELETE_THRESHOLD = 160;

export function NotificationItem({
  notification,
  onRead,
  onDelete,
  onNavigate,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const isUnread = !notification.read_at;
  const Icon = notificationIcons[notification.type] || Bell;
  const iconColor = notificationColors[notification.type] || 'text-muted-foreground';

  const [swipeX, setSwipeX] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);

  const triggerDelete = () => {
    setIsDeleting(true);
    // Show delete animation, then actually delete after animation
    setTimeout(() => {
      onDelete(notification.id);
    }, 300);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isDeleting) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || isDeleting) return;
    currentXRef.current = e.touches[0].clientX;
    const diff = startXRef.current - currentXRef.current;

    // If already revealed, allow swiping right to close or left to delete
    if (isRevealed) {
      const newSwipeX = Math.max(0, Math.min(REVEAL_WIDTH + diff, IMMEDIATE_DELETE_THRESHOLD + 20));
      setSwipeX(newSwipeX);
    } else {
      // Only allow left swipe (positive diff)
      const newSwipeX = Math.max(0, Math.min(diff, IMMEDIATE_DELETE_THRESHOLD + 20));
      setSwipeX(newSwipeX);
    }
  };

  const handleTouchEnd = () => {
    if (isDeleting) return;
    setIsSwiping(false);

    // If swiped far enough, trigger delete animation
    if (swipeX >= IMMEDIATE_DELETE_THRESHOLD) {
      triggerDelete();
      return;
    }

    // If swiped past reveal threshold, snap to revealed position
    if (swipeX >= REVEAL_THRESHOLD) {
      setSwipeX(REVEAL_WIDTH);
      setIsRevealed(true);
    } else {
      // Snap back to closed
      setSwipeX(0);
      setIsRevealed(false);
    }
  };

  const handleDeleteClick = () => {
    triggerDelete();
  };

  const handleClick = () => {
    // If revealed, close it instead of navigating
    if (isRevealed) {
      setSwipeX(0);
      setIsRevealed(false);
      return;
    }
    if (swipeX > 10) return; // Ignore click if swiping
    if (isUnread) {
      onRead(notification.id);
    }
    // Navigate using action_url, or fallback to event detail page if event_id exists
    const targetUrl =
      notification.action_url || (notification.event_id && `/events/${notification.event_id}`);
    if (targetUrl) {
      navigate(targetUrl);
      onNavigate?.();
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Full-width delete background (shown during delete animation) */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center gap-2 bg-destructive',
          'transition-opacity duration-200',
          isDeleting ? 'opacity-100' : 'opacity-0'
        )}
      >
        <Trash2 className="h-5 w-5 text-destructive-foreground" />
        <span className="text-sm font-medium text-destructive-foreground">Deleted</span>
      </div>

      {/* Delete button background (shown during swipe) */}
      <button
        onClick={handleDeleteClick}
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-center bg-destructive',
          'active:bg-destructive/80',
          swipeX > 0 && !isDeleting ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        style={{ width: Math.max(swipeX, REVEAL_WIDTH) }}
        aria-label="Delete notification"
      >
        <Trash2 className="h-5 w-5 text-destructive-foreground" />
      </button>

      {/* Notification content */}
      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="button"
        tabIndex={0}
        className={cn(
          'w-full flex items-start gap-3 p-3 text-left bg-background cursor-pointer',
          'hover:bg-muted/50 focus:bg-muted/50 focus:outline-none',
          isUnread && 'bg-muted/30',
          !isSwiping && 'transition-transform duration-200',
          isDeleting && 'translate-x-[-100%] transition-transform duration-300'
        )}
        style={!isDeleting ? { transform: `translateX(-${swipeX}px)` } : undefined}
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
      </div>
    </div>
  );
}
