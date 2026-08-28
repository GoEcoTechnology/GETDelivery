import { useState, useEffect, useCallback } from 'react';
import { messaging, getToken } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export function useFcmToken() {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [error, setError] = useState<string | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  // Check if running as a PWA
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalonePWA = window.matchMedia('(display-mode: standalone)').matches || 
                              ('standalone' in window.navigator && (window.navigator as any).standalone === true);
      setIsStandalone(isStandalonePWA);
    }
  }, []);

  const checkAndSetPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const currentPerm = Notification.permission;
      
      // If we detect permission was just granted externally (e.g. they came back from OS settings)
      // but we haven't registered the token yet, we automatically do it.
      if (currentPerm === 'granted' && permission !== 'granted') {
        setPermission('granted');
        
        // Auto-register since they enabled it
        if (messaging) {
          try {
            // Explicitly register service worker with config in URL params
            const swUrl = `/firebase-messaging-sw.js?apiKey=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}&projectId=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}&messagingSenderId=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}&appId=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}&authDomain=${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}&storageBucket=${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`;
            const registration = await navigator.serviceWorker.register(swUrl);
            await navigator.serviceWorker.ready;

            let currentToken;
            try {
              currentToken = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                serviceWorkerRegistration: registration,
              });
            } catch (tokenErr: any) {
              if (tokenErr.message && tokenErr.message.includes('Registration failed - push service error')) {
                console.warn('Corrupted push subscription detected. Unregistering service worker and retrying...');
                await registration.unregister();
                const newRegistration = await navigator.serviceWorker.register(swUrl);
                await navigator.serviceWorker.ready;
                currentToken = await getToken(messaging, {
                  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                  serviceWorkerRegistration: newRegistration,
                });
              } else {
                throw tokenErr;
              }
            }

            if (currentToken) {
              setToken(currentToken);
              await registerTokenInBackend(currentToken);
            }
          } catch (err) {
            console.error('Error auto-fetching token on resume:', err);
          }
        }
      } else {
        setPermission(currentPerm);
      }
    }
  }, [permission]);

  // Initial check and visibility listener
  useEffect(() => {
    checkAndSetPermission();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndSetPermission();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkAndSetPermission]);

  const requestPermissionAndGetToken = async () => {
    if (!messaging) {
      setError('Firebase Messaging is not supported in this browser.');
      return null;
    }

    try {
      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);

      if (currentPermission === 'granted') {
        // Explicitly register service worker with config in URL params
        const swUrl = `/firebase-messaging-sw.js?apiKey=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}&projectId=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}&messagingSenderId=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}&appId=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}&authDomain=${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}&storageBucket=${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`;
        const registration = await navigator.serviceWorker.register(swUrl);
        await navigator.serviceWorker.ready;

        // We use the VAPID key configured in Firebase Project Settings -> Cloud Messaging -> Web Push certificates
        let currentToken;
        try {
          currentToken = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            serviceWorkerRegistration: registration,
          });
        } catch (tokenErr: any) {
          if (tokenErr.message && tokenErr.message.includes('Registration failed - push service error')) {
            console.warn('Corrupted push subscription detected. Unregistering service worker and retrying...');
            await registration.unregister();
            const newRegistration = await navigator.serviceWorker.register(swUrl);
            await navigator.serviceWorker.ready;
            currentToken = await getToken(messaging, {
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              serviceWorkerRegistration: newRegistration,
            });
          } else {
            throw tokenErr;
          }
        }

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
      let browser = 'Unknown';
      let operatingSystem = 'Unknown';
      
      if (typeof window !== 'undefined' && window.navigator) {
        const ua = window.navigator.userAgent;
        if (ua.includes('Chrome')) browser = 'Chrome';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Edge')) browser = 'Edge';
        
        if (ua.includes('Win')) operatingSystem = 'Windows';
        else if (ua.includes('Mac')) operatingSystem = 'MacOS';
        else if (ua.includes('Linux')) operatingSystem = 'Linux';
        else if (ua.includes('Android')) operatingSystem = 'Android';
        else if (ua.includes('like Mac')) operatingSystem = 'iOS';
      }

      const response = await fetch('/api/device-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fcmToken,
          browser,
          operatingSystem,
          deviceName: `${operatingSystem} Device`
        }),
      });
      if (!response.ok) {
        console.error('Failed to register FCM token in backend');
      }
    } catch (error) {
      console.error('Error registering token', error);
    }
  };

  const deleteTokenFromBackend = async (fcmToken: string) => {
    try {
      await fetch('/api/device-tokens/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fcmToken }),
      });
    } catch (error) {
      console.error('Error deleting token on logout', error);
    }
  };

  return { token, permission, requestPermissionAndGetToken, registerTokenInBackend, deleteTokenFromBackend, error, isStandalone };
}
