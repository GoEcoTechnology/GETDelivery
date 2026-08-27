'use client';

import React, { useState, useEffect } from 'react';
import { useFcmToken } from '@/hooks/useFcmToken';
import styles from './page.module.css';
import Link from 'next/link';

export default function NotificationSettingsPage() {
  const { permission, requestPermissionAndGetToken, registerTokenInBackend } = useFcmToken();
  const [deviceInfo, setDeviceInfo] = useState({ browser: 'Unknown', os: 'Unknown' });
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>('');

  // Mock toggles state for demonstration
  const [toggles, setToggles] = useState({
    deliveryRequests: true,
    orderAccepted: true,
    orderDeclined: true,
    deliveryUpdates: true,
    systemAnnouncements: true,
    sound: true,
    vibration: true,
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.navigator) {
      const ua = window.navigator.userAgent;
      let browser = 'Unknown';
      let os = 'Unknown';
      
      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
      else if (ua.includes('Edge')) browser = 'Edge';
      
      if (ua.includes('Win')) os = 'Windows';
      else if (ua.includes('Mac')) os = 'MacOS';
      else if (ua.includes('Linux')) os = 'Linux';
      else if (ua.includes('Android')) os = 'Android';
      else if (ua.includes('like Mac')) os = 'iOS';
      
      setDeviceInfo({ browser, os });
      
      // Mock last synced time
      setLastSynced(new Date().toLocaleString());
    }
  }, []);

  const handleToggle = (key: keyof typeof toggles) => {
    if (permission !== 'granted') return;
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEnableNotifications = async () => {
    if (permission === 'denied') {
      alert("Notifications are blocked by your browser. Please click the site info icon in your URL bar and change the Notifications permission to 'Allow'.");
      return;
    }

    setIsLoading(true);
    const token = await requestPermissionAndGetToken();
    if (token) {
      await registerTokenInBackend(token);
      setLastSynced(new Date().toLocaleString());
    }
    setIsLoading(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/" style={{ color: '#4f46e5', textDecoration: 'none', marginBottom: '1rem', display: 'inline-block' }}>
          &larr; Back to Dashboard
        </Link>
        <h1 className={styles.title}>Notification Settings</h1>
        <p className={styles.subtitle}>Manage how you receive alerts and updates across your devices.</p>
      </div>

      <div className={styles.card}>
        <div className={styles.statusSection}>
          <div className={styles.statusInfo}>
            <h3>
              Status 
              <span className={`${styles.statusBadge} ${permission === 'granted' ? styles.enabled : styles.disabled}`}>
                {permission === 'granted' ? 'Enabled' : permission === 'denied' ? 'Blocked' : 'Disabled'}
              </span>
            </h3>
            <div className={styles.statusDetails}>
              <span><strong>Device:</strong> {deviceInfo.os} Device</span>
              <span><strong>Browser:</strong> {deviceInfo.browser}</span>
              {permission === 'granted' && (
                <span><strong>Last Synchronized:</strong> {lastSynced}</span>
              )}
            </div>
          </div>
          <div>
            {permission !== 'granted' && (
              <button 
                className={styles.actionBtn}
                onClick={handleEnableNotifications}
                disabled={isLoading}
              >
                {isLoading ? 'Enabling...' : 'Enable Notifications'}
              </button>
            )}
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h4>Delivery Alerts</h4>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <strong>Delivery Requests</strong>
              <p>Get notified instantly when a new delivery request is available.</p>
            </div>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={toggles.deliveryRequests && permission === 'granted'} 
                onChange={() => handleToggle('deliveryRequests')}
                disabled={permission !== 'granted'}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <strong>Order Accepted / Declined</strong>
              <p>Updates when a tenant or partner accepts/declines an order.</p>
            </div>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={toggles.orderAccepted && permission === 'granted'} 
                onChange={() => handleToggle('orderAccepted')}
                disabled={permission !== 'granted'}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <strong>Delivery Updates</strong>
              <p>Real-time status changes for active deliveries.</p>
            </div>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={toggles.deliveryUpdates && permission === 'granted'} 
                onChange={() => handleToggle('deliveryUpdates')}
                disabled={permission !== 'granted'}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h4>System Preferences</h4>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <strong>System Announcements</strong>
              <p>Important updates from the platform owner.</p>
            </div>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={toggles.systemAnnouncements && permission === 'granted'} 
                onChange={() => handleToggle('systemAnnouncements')}
                disabled={permission !== 'granted'}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <strong>Sound</strong>
              <p>Play a sound for new notifications.</p>
            </div>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={toggles.sound && permission === 'granted'} 
                onChange={() => handleToggle('sound')}
                disabled={permission !== 'granted'}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <strong>Vibration</strong>
              <p>Vibrate device on new notification (mobile only).</p>
            </div>
            <label className={styles.switch}>
              <input 
                type="checkbox" 
                checked={toggles.vibration && permission === 'granted'} 
                onChange={() => handleToggle('vibration')}
                disabled={permission !== 'granted'}
              />
              <span className={styles.slider}></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
