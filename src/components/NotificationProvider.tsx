'use client';

import { useEffect, useState } from 'react';
import { messaging, onMessage } from '@/lib/firebase';
import { useFcmToken } from '@/hooks/useFcmToken';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const { requestPermissionAndGetToken, registerTokenInBackend } = useFcmToken();

  useEffect(() => {
    // Attempt to register token silently if permission already granted
    if (Notification.permission === 'granted') {
      requestPermissionAndGetToken().then(token => {
        if (token) registerTokenInBackend(token);
      });
    }

    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('[NotificationProvider] Foreground message received:', payload);
        
        // Ensure browser supports notifications and permission is granted
        if ('Notification' in window && Notification.permission === 'granted') {
          const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
          const notificationOptions = {
            body: payload.notification?.body || payload.data?.body,
            icon: payload.notification?.icon || '/icons/icon-192x192.png',
            data: {
              url: payload.data?.url || '/',
            },
          };

          const notification = new Notification(notificationTitle, notificationOptions);

          notification.onclick = (event) => {
            event.preventDefault(); // prevent the browser from focusing the Notification's tab
            window.open(notification.data.url, '_self');
            notification.close();
          };
        }

        // Increment local unread count
        setUnreadCount((prev) => prev + 1);
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  return (
    <>
      {children}
    </>
  );
}
