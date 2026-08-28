importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Force immediate activation of the new service worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Access the environment variables passed via URL or fallback
const firebaseConfig = {
  apiKey: new URL(location).searchParams.get('apiKey'),
  authDomain: new URL(location).searchParams.get('authDomain'),
  projectId: new URL(location).searchParams.get('projectId'),
  storageBucket: new URL(location).searchParams.get('storageBucket'),
  messagingSenderId: new URL(location).searchParams.get('messagingSenderId'),
  appId: new URL(location).searchParams.get('appId'),
};

// Only initialize if we have config
if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    // If notification payload exists, FCM SDK automatically displays it.
    // We only need to manually show it if it's a data-only payload.
    if (!payload.notification) {
      const notificationTitle = payload.data?.title || 'New Notification';
      const notificationOptions = {
        body: payload.data?.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [200, 100, 200, 100, 200],
        data: {
          url: payload.data?.action_url || payload.data?.url || payload.data?.click_action || '/',
        },
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    }
  });
}

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.', event.notification.data);
  event.notification.close();

  // Try to get URL from our manual data-only push OR from Firebase's auto-generated push
  let urlToOpen = '/';
  
  if (event.notification.data?.url) {
    urlToOpen = event.notification.data.url;
  } else if (event.notification.data?.FCM_MSG?.data?.action_url) {
    urlToOpen = event.notification.data.FCM_MSG.data.action_url;
  } else if (event.notification.data?.FCM_MSG?.data?.url) {
    urlToOpen = event.notification.data.FCM_MSG.data.url;
  } else if (event.notification.data?.FCM_MSG?.notification?.click_action) {
    urlToOpen = event.notification.data.FCM_MSG.notification.click_action;
  }

  // Get absolute URL for reliable matching
  const targetUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, focus it and navigate.
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        } else if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => c.navigate(targetUrl));
        }
      }
      // If not, open the target URL in a new window/tab.
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
