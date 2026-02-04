import { useState, useRef, useEffect } from 'react';
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
  isRevealed: boolean;
  onRevealChange: (revealed: boolean) => void;
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

// Get viewport-based thresholds
const getDeleteThreshold = () => window.innerWidth / 3;
const getRevealWidth = () => window.innerWidth / 4;

export function NotificationItem({
  notification,
  onRead,
  onDelete,
  onNavigate,
  isRevealed,
  onRevealChange,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const isUnread = !notification.read_at;
  const Icon = notificationIcons[notification.type] || Bell;
  const iconColor = notificationColors[notification.type] || 'text-muted-foreground';

  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const swipeStartXRef = useRef(0);
  const directionLockedRef = useRef<'horizontal' | 'vertical' | null>(null);

  // Sync swipeX when revealed state changes from parent
  useEffect(() => {
    if (!isSwiping) {
      setSwipeX(isRevealed ? getRevealWidth() : 0);
    }
  }, [isRevealed, isSwiping]);

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
    startYRef.current = e.touches[0].clientY;
    swipeStartXRef.current = swipeX;
    directionLockedRef.current = null;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping || isDeleting) return;
    const diffX = startXRef.current - e.touches[0].clientX;
    const diffY = e.touches[0].clientY - startYRef.current;

    // Lock direction on first significant movement
    if (directionLockedRef.current === null) {
      const absX = Math.abs(diffX);
      const absY = Math.abs(diffY);
      if (absX > 10 || absY > 10) {
        directionLockedRef.current = absX > absY ? 'horizontal' : 'vertical';
      }
    }

    // Ignore if scrolling vertically
    if (directionLockedRef.current === 'vertical') return;

    // Follow the finger from where we started
    setSwipeX(Math.max(0, swipeStartXRef.current + diffX));
  };

  const handleTouchEnd = () => {
    if (isDeleting) return;
    setIsSwiping(false);
    directionLockedRef.current = null;

    const deleteThreshold = getDeleteThreshold();
    const revealWidth = getRevealWidth();

    // If swiped more than 1/3 of viewport, trigger delete
    if (swipeX >= deleteThreshold) {
      triggerDelete();
    } else if (swipeX > 20) {
      // Snap to 1/4 of viewport showing delete button
      setSwipeX(revealWidth);
      onRevealChange(true);
    } else {
      // Spring back to closed
      setSwipeX(0);
      onRevealChange(false);
    }
  };

  const handleDeleteClick = () => {
    triggerDelete();
  };

  const handleClick = () => {
    // If revealed, close it instead of navigating
    if (isRevealed) {
      onRevealChange(false);
      return;
    }
    if (swipeX > 10) return; // Ignore click if swiping
    if (isUnread) {
      onRead(notification.id);
    }
    // Navigate using action_url, or fallback to event detail page if event_id exists
    const targetUrl =
      notification.action_url || (notification.event_id && `/signup/${notification.event_id}`);
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
        style={{ width: swipeX }}
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
            <p className={cn('text-xs font-medium truncate', isUnread && 'font-semibold')}>
              {notification.title}
            </p>
            {isUnread && <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />}
          </div>
          <p className="text-xs text-muted-foreground truncate">{notification.body}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatTimeAgo(notification.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
