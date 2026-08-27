'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useFcmToken } from '@/hooks/useFcmToken';
import styles from './NotificationPermissionModal.module.css';

export default function NotificationPermissionModal() {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettingsInstructions, setShowSettingsInstructions] = useState(false);
  const [osName, setOsName] = useState('Unknown');
  
  const { requestPermissionAndGetToken, registerTokenInBackend, isStandalone, permission } = useFcmToken();

  useEffect(() => {
    // Only run on client side and if Notification is supported
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    // Detect OS for instructions
    const ua = window.navigator.userAgent;
    if (ua.includes('Win')) setOsName('Windows');
    else if (ua.includes('Android')) setOsName('Android');
    else if (ua.includes('like Mac')) setOsName('iOS');
    else if (ua.includes('Mac')) setOsName('MacOS');

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

      // Automatically show modal for PWAs if notifications are NOT granted
      // For non-PWAs, only show it if it's default (don't annoy denied users on web)
      if (isStandalone && permission !== 'granted') {
        setShowModal(true);
      } else if (!isStandalone && permission === 'default') {
        setShowModal(true);
      } else {
        setShowModal(false);
      }
    };

    // Small delay to ensure dashboard renders first
    const timer = setTimeout(checkPermission, 1500);
    return () => clearTimeout(timer);
  }, [pathname, isStandalone, permission]);

  const handleEnable = async () => {
    if (permission === 'denied') {
      // Fallback to instructions because browsers don't let us deep-link natively for PWAs
      setShowSettingsInstructions(true);
      return;
    }

    setIsLoading(true);
    const token = await requestPermissionAndGetToken();
    if (token) {
      await registerTokenInBackend(token);
      setShowModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    } else {
      if (Notification.permission === 'denied') {
        setShowSettingsInstructions(true);
      }
    }
    setIsLoading(false);
  };

  const handleMaybeLater = () => {
    localStorage.setItem('notification_prompt_dismissed_at', Date.now().toString());
    setShowModal(false);
  };

  const handleClose = () => {
    setShowModal(false);
    setShowSettingsInstructions(false);
  };

  if (!showModal && !showToast) return null;

  return (
    <>
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            
            {!showSettingsInstructions ? (
              <>
                <div className={styles.iconContainer}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h2 className={styles.title}>Enable Notifications for This App</h2>
                <p className={styles.description}>
                  Enable notifications for this installed app so you can instantly receive delivery requests, order updates, and accept/decline alerts even when the app is closed or running in the background.
                </p>
                
                <div className={styles.actions}>
                  <button 
                    className={styles.primaryBtn} 
                    onClick={handleEnable}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Loading...' : 'Open Notification Settings'}
                  </button>
                  <button className={styles.secondaryBtn} onClick={handleMaybeLater}>
                    Maybe Later
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={styles.iconContainerBlocked}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className={styles.title}>How to Enable Notifications</h2>
                
                <div className={styles.instructionBox}>
                  {osName === 'iOS' && (
                    <ol>
                      <li>Open your iPhone's <strong>Settings</strong> app.</li>
                      <li>Scroll down and tap on <strong>GETDelivery</strong>.</li>
                      <li>Tap on <strong>Notifications</strong>.</li>
                      <li>Toggle <strong>Allow Notifications</strong> to ON.</li>
                      <li>Return to this app.</li>
                    </ol>
                  )}
                  {osName === 'Android' && (
                    <ol>
                      <li>Open your Android <strong>Settings</strong> app.</li>
                      <li>Tap on <strong>Apps</strong> or <strong>App Management</strong>.</li>
                      <li>Find and select <strong>GETDelivery</strong>.</li>
                      <li>Tap on <strong>Notifications</strong>.</li>
                      <li>Toggle <strong>Show Notifications</strong> to ON.</li>
                      <li>Return to this app.</li>
                    </ol>
                  )}
                  {(osName !== 'iOS' && osName !== 'Android') && (
                    <ol>
                      <li>Click the site information icon (lock icon) in your browser's address bar.</li>
                      <li>Find the <strong>Notifications</strong> permission.</li>
                      <li>Change it from "Block" to <strong>Allow</strong>.</li>
                      <li>Return to this app.</li>
                    </ol>
                  )}
                </div>

                <div className={styles.actions}>
                  <button className={styles.secondaryBtn} onClick={handleClose}>
                    Got it
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
