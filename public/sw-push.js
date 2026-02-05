/**
 * Push notification handler for the service worker
 * This file is imported by the main service worker via workbox.importScripts
 */

// Handle push notification events
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('Push event received but no data');
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch {
    console.warn('Failed to parse push data as JSON');
    data = {
      title: 'New Notification',
      body: event.data.text(),
    };
  }

  const title = data.title || 'Roster';
  const options = {
    body: data.body || '',
    icon: '/icon-192x192.svg',
    badge: '/icon-192x192.svg',
    tag: data.data?.type || 'default',
    renotify: true,
    data: data.data || {},
    // Vibration pattern for mobile devices
    vibrate: [100, 50, 100],
    // Actions the user can take
    actions: [
      {
        action: 'open',
        title: 'View',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle dismiss action
  if (event.action === 'dismiss') {
    return;
  }

  // Get the URL to navigate to (from notification data or default)
  const urlPath = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window open with the app
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Navigate to the notification URL and focus the window
            return client.navigate(urlPath).then((client) => client?.focus());
          }
        }
        // If no existing window, open a new one
        return clients.openWindow(urlPath);
      })
  );
});

// Handle notification close events (optional analytics)
self.addEventListener('notificationclose', (event) => {
  // Could send analytics about dismissed notifications
  console.log('Notification dismissed:', event.notification.tag);
});

/**
 * Get VAPID public key from IndexedDB (stored by main app on subscription)
 */
async function getVapidKeyFromStorage() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('push-config', 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config');
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('config', 'readonly');
      const store = tx.objectStore('config');
      const getRequest = store.get('vapidPublicKey');

      getRequest.onsuccess = () => {
        db.close();
        resolve(getRequest.result);
      };
      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };
  });
}

/**
 * Convert URL-safe base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Handle push subscription change events
self.addEventListener('pushsubscriptionchange', (event) => {
  // This fires when the push subscription expires or is revoked
  console.log('Push subscription changed, attempting re-subscription');

  event.waitUntil(
    (async () => {
      try {
        // Get stored VAPID key
        const vapidKey = await getVapidKeyFromStorage();
        if (!vapidKey) {
          console.warn('No VAPID key stored, cannot re-subscribe');
          return;
        }

        // Re-subscribe with the stored VAPID key
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        console.log('Re-subscribed to push:', subscription.endpoint);

        // Note: The new subscription endpoint should be synced to the server.
        // This will happen automatically when the user opens the app, as the
        // subscription will be detected and updated via pushSubscriptionService.
      } catch (error) {
        console.error('Failed to re-subscribe to push:', error);
      }
    })()
  );
});

console.log('Push notification handlers registered');
