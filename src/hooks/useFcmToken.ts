import { useState, useEffect } from 'react';
import { messaging, getToken } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export function useFcmToken() {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermissionAndGetToken = async () => {
    if (!messaging) {
      setError('Firebase Messaging is not supported in this browser.');
      return null;
    }

    try {
      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);

      if (currentPermission === 'granted') {
        // We use the VAPID key configured in Firebase Project Settings -> Cloud Messaging -> Web Push certificates
        const currentToken = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        });

        if (currentToken) {
          setToken(currentToken);
          return currentToken;
        } else {
          setError('No registration token available. Request permission to generate one.');
          return null;
        }
      } else {
        setError('Notification permission denied.');
        return null;
      }
    } catch (err: any) {
      console.error('An error occurred while retrieving token. ', err);
      setError(err.message || 'Error getting token');
      return null;
    }
  };

  const registerTokenInBackend = async (fcmToken: string) => {
    try {
      const response = await fetch('/api/device-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken }),
      });
      if (!response.ok) {
        console.error('Failed to register FCM token in backend');
      }
    } catch (error) {
      console.error('Error registering token', error);
    }
  };

  return { token, permission, requestPermissionAndGetToken, registerTokenInBackend, error };
}
