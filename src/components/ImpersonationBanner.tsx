import { useAuth } from '@/hooks/useAuth';
import { StickyBanner } from '@/components/StickyBanner';
import { ShieldAlert } from 'lucide-react';
import { getUserDisplayName } from '@/lib/utils';

export function ImpersonationBanner() {
  const { user, isImpersonating, stopImpersonating } = useAuth();

  if (!isImpersonating || !user) return null;

  return (
    <StickyBanner
      icon={ShieldAlert}
      message={`Viewing as ${getUserDisplayName(user)}`}
      actionLabel="Return"
      onAction={async () => {
        try {
          await stopImpersonating();
        } catch {
          // fallthrough
        }
        window.location.href = '/events';
      }}
    />
  );
}
