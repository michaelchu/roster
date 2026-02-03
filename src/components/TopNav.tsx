import { useNavigate, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { NotificationCenter } from '@/components/notifications';

interface TopNavProps {
  showCloseButton?: boolean;
  closePath?: string;
  onClose?: () => void;
  sticky?: boolean;
  className?: string;
}

export function TopNav({
  showCloseButton = false,
  closePath,
  onClose,
  sticky = false,
  className,
}: TopNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (closePath) {
      navigate(closePath);
    } else {
      // Check if there's navigation state or if we should use a default fallback
      if (window.history.state && window.history.state.idx > 0) {
        // There's history within the app, safe to go back
        navigate(-1);
      } else {
        // No history or first page, provide a sensible default based on current path
        if (location.pathname.startsWith('/signup/')) {
          navigate('/events');
        } else if (location.pathname.startsWith('/groups/')) {
          navigate('/groups');
        } else {
          navigate('/');
        }
      }
    }
  };

  const showNotifications = !!user;

  return (
    <div className={cn('bg-card border-b', sticky && 'sticky top-0 z-10', className)}>
      <div className="flex items-center justify-center px-4 py-2 relative">
        {/* Center - Logo with padding to prevent overlap on narrow screens */}
        <h1
          className={cn(
            'text-lg font-semibold text-center truncate flex items-center justify-center gap-1',
            (showNotifications || showCloseButton) && 'px-12'
          )}
        >
          <span>Roster</span>
          <span className="text-[10px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent -translate-y-1">
            BETA
          </span>
        </h1>

        {/* Right side - Notifications and/or Close button */}
        <div className="absolute right-4 flex items-center gap-2">
          {showNotifications && <NotificationCenter />}
          {showCloseButton && (
            <button onClick={handleClose} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
