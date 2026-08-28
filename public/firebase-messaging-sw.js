importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const firebaseConfig = {
  apiKey: new URL(location).searchParams.get('apiKey'),
  authDomain: new URL(location).searchParams.get('authDomain'),
  projectId: new URL(location).searchParams.get('projectId'),
  storageBucket: new URL(location).searchParams.get('storageBucket'),
  messagingSenderId: new URL(location).searchParams.get('messagingSenderId'),
  appId: new URL(location).searchParams.get('appId'),
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    // We force manual display for full control over the notification appearance and click behavior.
    const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      vibrate: [200, 100, 200, 100, 200],
      data: {
        url: payload.data?.action_url || payload.data?.url || payload.fcmOptions?.link || '/',
      },
      // Tag prevents stacking of duplicates if FCM SDK also tries to display it
      tag: payload.messageId || notificationTitle + Date.now() 
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

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
