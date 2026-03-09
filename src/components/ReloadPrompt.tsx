import { useRegisterSW } from 'virtual:pwa-register/react';
import { StickyBanner } from '@/components/StickyBanner';
import { RefreshCw } from 'lucide-react';

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <StickyBanner
      icon={RefreshCw}
      message="A new version is available"
      actionLabel="Refresh"
      onAction={() => updateServiceWorker(true)}
    />
  );
}
