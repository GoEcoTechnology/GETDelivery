'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useFcmToken } from '@/hooks/useFcmToken';
import styles from './NotificationPermissionModal.module.css';

export default function NotificationPermissionModal() {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { requestPermissionAndGetToken, registerTokenInBackend } = useFcmToken();

  useEffect(() => {
    // Only run on client side and if Notification is supported
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    // Do not show on auth pages or root landing page
    if (pathname === '/login' || pathname === '/register' || pathname === '/') return;

    // Check if user is logged in
    const user = localStorage.getItem('user');
    if (!user) return;

    const checkPermission = async () => {
      // Check cooldown for "Maybe Later"
      const dismissedAt = localStorage.getItem('notification_prompt_dismissed_at');
      if (dismissedAt) {
        const timeSinceDismissed = Date.now() - parseInt(dismissedAt, 10);
        const cooldownPeriod = 12 * 60 * 60 * 1000; // 12 hours
        if (timeSinceDismissed < cooldownPeriod) {
          return;
        }
      }

      if (Notification.permission === 'default') {
        setShowModal(true);
      } else if (Notification.permission === 'denied') {
        // Optionally show blocked modal if we want to prompt them to unblock
        // For now, we only show modal for 'default' to not annoy 'denied' users on every login,
        // but if we want to show it, we need to respect the cooldown.
        // We'll skip auto-showing for 'denied' here to follow standard practices,
        // and let them enable it via Settings page.
      }
    };

    // Small delay to ensure dashboard renders first
    const timer = setTimeout(checkPermission, 1500);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleEnable = async () => {
    setIsLoading(true);
    
    // In case they previously blocked it, we can't trigger the prompt
    if (Notification.permission === 'denied') {
      setIsBlocked(true);
      setIsLoading(false);
      return;
    }

    const token = await requestPermissionAndGetToken();
    if (token) {
      await registerTokenInBackend(token);
      setShowModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    } else {
      if ((Notification.permission as NotificationPermission) === 'denied') {
        setIsBlocked(true);
      }
    }
    setIsLoading(false);
  };

  const handleMaybeLater = () => {
    localStorage.setItem('notification_prompt_dismissed_at', Date.now().toString());
    setShowModal(false);
  };

  const handleOpenSettings = () => {
    setShowModal(false);
    // User needs to manually open browser settings, we just hide the modal
  };

  if (!showModal && !showToast) return null;

  return (
    <>
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.iconContainer}>
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            
            {!isBlocked ? (
              <>
                <h2 className={styles.title}>Turn On Notifications</h2>
                <p className={styles.description}>
                  Enable notifications for this app/website so you can instantly receive delivery requests, order updates, accept/decline alerts, and important system notifications — even when the app or browser is in the background.
                </p>
                <ul className={styles.featuresList}>
                  <li>Instant delivery request notifications</li>
                  <li>Accept and decline order updates</li>
                  <li>Delivery status updates</li>
                  <li>Background notifications even when minimized</li>
                  <li>Sound and vibration alerts</li>
                </ul>
                <div className={styles.actions}>
                  <button 
                    className={styles.primaryBtn} 
                    onClick={handleEnable}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Enabling...' : 'Turn On Notifications'}
                  </button>
                  <button className={styles.secondaryBtn} onClick={handleMaybeLater}>
                    Maybe Later
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className={styles.title}>Notifications Blocked</h2>
                <p className={styles.description}>
                  Notifications are currently blocked for this app/website.
                  To receive delivery requests, enable notifications in your browser or phone settings.
                </p>
                <div className={styles.actions}>
                  <button className={styles.primaryBtn} onClick={handleOpenSettings}>
                    Understood
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showToast && (
        <div className={styles.toast}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <strong>Notifications Enabled Successfully</strong>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              You will now receive delivery requests instantly on this device.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
