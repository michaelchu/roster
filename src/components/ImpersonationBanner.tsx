import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ShieldAlert } from 'lucide-react';
import { getUserDisplayName } from '@/lib/utils';

export function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonating } = useAuth();

  if (!isImpersonating || !user) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-destructive/10 border-destructive/30 sticky top-0 z-50">
      <ShieldAlert className="h-4 w-4 !text-destructive" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-xs font-medium text-destructive">
          Viewing as {getUserDisplayName(user)} ({user.email})
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={stopImpersonating}
        >
          Return to admin
        </Button>
      </AlertDescription>
    </Alert>
  );
}
