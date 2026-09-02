'use client';

import Link from 'next/link';
import { Play, Package, Truck, Box, BarChart3, Navigation } from 'lucide-react';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.container}>
      {/* Dynamic Background */}
      <div className={styles.bgGlow1}></div>
      <div className={styles.bgGlow2}></div>

      {/* Floating 3D/Glass Icons */}
      <div className={`${styles.floatingElement} ${styles.float1}`}>
        <div className={styles.glassIconBox}><Package size={40} color="#3b82f6" /></div>
      </div>
      <div className={`${styles.floatingElement} ${styles.float2}`}>
        <div className={styles.glassIconBox}><Truck size={48} color="#8b5cf6" /></div>
      </div>
      <div className={`${styles.floatingElement} ${styles.float3}`}>
        <div className={styles.glassIconBox}><Box size={32} color="#ec4899" /></div>
      </div>
      <div className={`${styles.floatingElement} ${styles.float4}`}>
        <div className={styles.glassIconBox}><BarChart3 size={36} color="#10b981" /></div>
      </div>

      {/* Navigation */}
      <nav className={styles.navbar}>
        <div className={styles.logo}>
          <Navigation size={28} className={styles.logoIcon} />
          <span>GETDelivery</span>
        </div>
        <div className={styles.navLinks}>
          <Link href="/">Home</Link>
          <Link href="/">About</Link>
          <Link href="/">Solutions</Link>
          <Link href="/">Features</Link>
          <Link href="/">Platform</Link>
        </div>
        <div className={styles.navActions}>
          <Link href="/login" className={styles.navBtn}>Login Portal</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div className={styles.hero}>
        <h1 className={styles.title}>
          The unified platform for inventory and <span className={styles.highlight}>delivery logistics
            <svg className={styles.underline} viewBox="0 0 200 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M5,15 Q100,5 195,15" fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </span>
        </h1>
        <p className={styles.subtitle}>
          GETDelivery connects businesses, dispatchers, and drivers securely and quickly.
          The best-trusted multi-tenant logistics management system.
        </p>

        <div className={styles.heroActions}>
          <Link href="/login" className={styles.primaryBtn}>
            GET STARTED NOW
          </Link>
          <button className={styles.secondaryBtn}>
            <div className={styles.playIconWrapper}>
              <Play size={16} fill="currentColor" />
            </div>
            EXPLORE FEATURES
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className={styles.statsContainer}>
        <div className={styles.statsItem}>
          <span className={styles.statsNumber}>10M+</span> Deliveries completed
        </div>
        <div className={styles.statsDivider}></div>
        <div className={styles.statsItem}>
          <span className={styles.statsNumber}>500+</span> Active tenants
        </div>
      </div>
    </main>
  );
}
