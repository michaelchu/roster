import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopNavProps {
  title: string;
  showBackButton?: boolean;
  backPath?: string;
  onBack?: () => void;
  sticky?: boolean;
  className?: string;
}

export function TopNav({
  title,
  showBackButton = false,
  backPath,
  onBack,
  sticky = false,
  className,
}: TopNavProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={cn('bg-card border-b', sticky && 'sticky top-0 z-10', className)}>
      <div className="flex items-center justify-center px-4 py-2 relative">
        {showBackButton && (
          <button onClick={handleBack} className="absolute left-4" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-semibold text-center">{title}</h1>
      </div>
    </div>
  );
}
