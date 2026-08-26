'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function PartnerNotifListener() {
  const router = useRouter();
  const lastNotifiedCount = useRef(0);

  useEffect(() => {
    // Request permission for browser notifications on mount
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }

    const checkNotifications = async () => {
      try {
        const res = await fetch('/api/partner/notifications/unread');
        if (res.ok) {
          const data = await res.json();
          const currentCount = data.count;
          
          if (currentCount > lastNotifiedCount.current) {
            // New unread notifications detected! Show a system notification
            if ('Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification('New Delivery Request!', {
                body: 'You have received a new delivery opportunity from GET Delivery.',
                icon: '/favicon.ico'
              });
              
              notification.onclick = () => {
                window.focus();
                router.push('/partner/orders');
              };
            }
          }
          
          lastNotifiedCount.current = currentCount;
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };

    // Initial check
    checkNotifications();

    // Poll every 10 seconds
    const interval = setInterval(checkNotifications, 10000);
    return () => clearInterval(interval);
  }, [router]);

  // This component doesn't render anything visible, it just runs in the background
  return null;
}
