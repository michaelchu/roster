import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, UsersRound, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useFeatureFlag } from '@/hooks/useFeatureFlags';

const navItems = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Calendar, label: 'Events', path: '/events' },
  { icon: UsersRound, label: 'Groups', path: '/groups' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const isHomePageEnabled = useFeatureFlag('home_page');

  // Hide navigation for non-authenticated users
  if (!user) {
    return null;
  }

  // Filter out Home nav item if home_page flag is disabled
  const visibleNavItems = navItems.filter((item) => item.path !== '/' || isHomePageEnabled);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex justify-around items-center h-14">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-1 text-xs',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-label={`Navigate to ${item.label}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5 mb-1" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
