'use client';

import { useEffect, useState } from 'react';
import { messaging } from '@/lib/firebase';
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

    // Listen to the pure W3C Service Worker via BroadcastChannel
    const channel = new BroadcastChannel('fcm_channel');
    channel.onmessage = (event) => {
      const payload = event.data;
      console.log('[NotificationProvider] Foreground message received via BroadcastChannel:', payload);
      
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
          
          // The Service Worker already handles the native OS notification popup!
          // We do NOT call registration.showNotification here, otherwise Chrome flags it as abusive/spam 
          
          return next;
        });
      }

      // Increment local unread count
      setUnreadCount((prev) => prev + 1);
    };

    return () => {
      channel.close();
    };
  }, []);

  return (
    <>
      <NotificationPermissionModal />
      {children}
    </>
  );
}
