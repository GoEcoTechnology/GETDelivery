'use client';

import React from 'react';
import styles from './page.module.css';
import Link from 'next/link';

export default function NotificationSettingsPage() {
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
              Notification Status 
              <span className={`${styles.statusBadge} ${styles.enabled}`}>
                Email Enabled
              </span>
            </h3>
            <div className={styles.statusDetails}>
              <span>All notifications are now securely delivered directly to your registered Email address. No browser configuration is required.</span>
            </div>
          </div>
        </div>

        <div className={styles.settingsGroup}>
          <h4>Delivery Alerts (Email)</h4>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <strong>Delivery Requests</strong>
              <p>Get notified instantly via Email when a new delivery request is available.</p>
            </div>
            <label className={styles.switch}>
              <input type="checkbox" checked={true} disabled={true} />
              <span className={styles.slider}></span>
            </label>
          </div>
          <div className={styles.settingItem}>
            <div className={styles.settingInfo}>
              <strong>Order Accepted / Declined</strong>
              <p>Email updates when a tenant or partner accepts/declines an order.</p>
            </div>
            <label className={styles.switch}>
              <input type="checkbox" checked={true} disabled={true} />
              <span className={styles.slider}></span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
