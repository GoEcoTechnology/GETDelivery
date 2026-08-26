import { Metadata } from 'next';
import Link from 'next/link';
import { Package, Bell } from 'lucide-react';
import styles from './partner.module.css';
import PartnerNotifListener from './PartnerNotifListener';

import { NotificationCenter } from '@/components/NotificationCenter';

export const metadata: Metadata = {
  title: 'Partner Portal | GET Delivery',
  description: 'Portal for GET Delivery Partners',
};

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.container}>
      {/* Mobile-first sticky header */}
      <header className={styles.header}>
        <div className={styles.headerContent} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className={styles.logo}>GET<span className={styles.logoLight}>Partner</span></span>
          </div>
          <NotificationCenter />
        </div>
      </header>

      {/* Main Content Area */}
      <main className={styles.main}>
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className={styles.bottomNav}>
        <div className={styles.bottomNavContent}>
          <Link href="/partner/orders" className={styles.navItem}>
            <Package size={24} style={{ marginBottom: '4px' }} />
            <span className={styles.navLabel}>Orders</span>
          </Link>
          <Link href="/partner/notifications" className={styles.navItem}>
            <Bell size={24} style={{ marginBottom: '4px' }} />
            <span className={styles.navLabel}>Alerts</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
