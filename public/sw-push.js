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
          // If we find an existing window, focus it and navigate
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then((focusedClient) => {
              // Navigate to the notification URL if different
              if (focusedClient && 'navigate' in focusedClient) {
                return focusedClient.navigate(urlPath);
              }
            });
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

// Handle push subscription change events
self.addEventListener('pushsubscriptionchange', (event) => {
  // This fires when the push subscription expires or is revoked
  // The app should re-subscribe when this happens
  console.log('Push subscription changed, may need to re-subscribe');

  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        // Note: applicationServerKey would need to be stored or fetched
      })
      .then((subscription) => {
        // Send the new subscription to the server
        // This would require fetching the VAPID key and posting to our API
        console.log('Re-subscribed to push:', subscription.endpoint);
      })
      .catch((error) => {
        console.error('Failed to re-subscribe to push:', error);
      })
  );
});

console.log('Push notification handlers registered');
