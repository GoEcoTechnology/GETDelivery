'use client';

import { useEffect, useState } from 'react';
import { messaging, onMessage } from '@/lib/firebase';
import { useFcmToken } from '@/hooks/useFcmToken';
import NotificationPermissionModal from './NotificationPermissionModal';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentPushes, setRecentPushes] = useState<Set<string>>(new Set());
  const { requestPermissionAndGetToken, registerTokenInBackend } = useFcmToken();

  useEffect(() => {
    const user = localStorage.getItem('user');
    
    // Attempt to register token silently if permission already granted and user is logged in
    if (Notification.permission === 'granted' && user) {
      requestPermissionAndGetToken().then(fcmToken => {
        if (fcmToken) registerTokenInBackend(fcmToken);
      });
    }

    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('[NotificationProvider] Foreground message received:', payload);
        
        // Ensure browser supports notifications and permission is granted
        if ('Notification' in window && Notification.permission === 'granted') {
          const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
          const notificationId = payload.messageId || notificationTitle + Date.now();
          
          setRecentPushes(prev => {
            if (prev.has(notificationId)) return prev;
            
            const next = new Set(prev);
            next.add(notificationId);
            
            // Clean up old IDs to prevent memory leak
            if (next.size > 50) {
              const iterator = next.values();
              next.delete(iterator.next().value!);
            }
            
            const notificationOptions = {
              body: payload.notification?.body || payload.data?.body,
              icon: payload.notification?.icon || '/icons/icon-192x192.png',
              badge: payload.notification?.icon || '/icons/icon-192x192.png',
              data: {
                url: payload.data?.action_url || payload.data?.url || '/',
              },
              tag: notificationId // Helps prevent duplicate native stacking
            };

            // Use Service Worker to show notification (Native OS support)
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then((registration) => {
                registration.showNotification(notificationTitle, notificationOptions);
              });
            }

            return next;
          });
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
      <NotificationPermissionModal />
      {children}
    </>
  );
}
