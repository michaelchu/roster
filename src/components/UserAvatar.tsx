import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showIcon?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export function UserAvatar({
  name,
  avatarUrl,
  size = 'sm',
  className,
  showIcon = false,
}: UserAvatarProps) {
  const initial = name?.charAt(0).toUpperCase() || '';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'User avatar'}
        className={cn(sizeClasses[size], 'rounded-full object-cover flex-shrink-0', className)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClasses[size],
        'bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0',
        className
      )}
    >
      {showIcon ? (
        <User className={cn(iconSizeClasses[size], 'text-white')} />
      ) : (
        <span className={cn(textSizeClasses[size], 'font-medium text-white')}>{initial}</span>
      )}
    </div>
  );
}
