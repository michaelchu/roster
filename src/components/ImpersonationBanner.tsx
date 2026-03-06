import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { getUserDisplayName } from '@/lib/utils';

export function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonating } = useAuth();

  if (!isImpersonating || !user) return null;

  return (
    <div className="sticky top-0 z-50 bg-yellow-50 border-b border-yellow-300 px-4 py-2 dark:bg-yellow-950 dark:border-yellow-700">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
          <span className="text-xs font-medium text-yellow-800 dark:text-yellow-200 truncate">
            Viewing as {getUserDisplayName(user)}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs shrink-0 border-yellow-400 text-yellow-800 bg-yellow-100 hover:bg-yellow-200 dark:border-yellow-600 dark:text-yellow-200 dark:bg-yellow-900 dark:hover:bg-yellow-800"
          onClick={async () => {
            try {
              await stopImpersonating();
            } catch {
              // fallthrough
            }
            window.location.href = '/events';
          }}
        >
          Return
        </Button>
      </div>
    </div>
  );
}
