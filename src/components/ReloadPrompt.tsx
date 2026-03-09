import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { StickyBanner } from '@/components/StickyBanner';
import { RefreshCw } from 'lucide-react';

const CHECK_INTERVAL_MS = 10_000; // check every 10 seconds

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, CHECK_INTERVAL_MS);
      }
    },
  });

  // Also check when user returns to the tab
  useEffect(() => {
    const onVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const registration = await navigator.serviceWorker?.getRegistration();
        registration?.update();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  if (!needRefresh) return null;

  return (
    <StickyBanner
      icon={RefreshCw}
      message="A new version is available"
      actionLabel="Refresh"
      onAction={async () => {
        await updateServiceWorker(true);
        window.location.reload();
      }}
    />
  );
}
