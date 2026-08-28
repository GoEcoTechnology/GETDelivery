// Pure W3C Web Push Service Worker for GETDelivery
// Completely decoupled from Firebase Web SDK for 100% background reliability.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    console.log('[firebase-messaging-sw.js] Pure Push received: ', payload);

    // Notify any open foreground tabs via BroadcastChannel
    try {
      const channel = new BroadcastChannel('fcm_channel');
      channel.postMessage(payload);
    } catch (e) {
      console.warn('BroadcastChannel failed', e);
    }

    const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [200, 100, 200, 100, 200],
      data: {
        url: payload.data?.action_url || payload.data?.url || payload.fcmOptions?.link || '/',
      },
      requireInteraction: true,
      tag: payload.messageId || notificationTitle + Date.now()
    };

    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
    );
  } catch (err) {
    console.error('Error parsing push payload', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.', event.notification.data);
  event.notification.close();

  let urlToOpen = '/';
  if (event.notification.data?.url) {
    urlToOpen = event.notification.data.url;
  } else if (event.notification.data?.FCM_MSG?.data?.action_url) {
    urlToOpen = event.notification.data.FCM_MSG.data.action_url;
  } else if (event.notification.data?.FCM_MSG?.data?.url) {
    urlToOpen = event.notification.data.FCM_MSG.data.url;
  }

  const targetUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        } else if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => c.navigate(targetUrl));
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
