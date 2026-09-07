'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from '../admin/admin.module.css';

import { 
  LayoutDashboard, 
  Package, 
  Bell, 
  LogOut,
  Briefcase,
  User,
  Truck,
  MapPinned,
  CheckSquare
} from 'lucide-react';
import PartnerNotifListener from './PartnerNotifListener';
import NotificationBell from '../admin/NotificationBell';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{name: string, role: string} | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const userData = localStorage.getItem('user');
      if (!userData) {
        router.push('/login');
        return;
      }
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'DELIVERY_PARTNER') {
        router.push('/login');
        return;
      }
      setUser(parsedUser);
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => setSidebarOpen(false), 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  const handleLogout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
    router.push('/login');
  };

  if (!user) return <div className={styles.loading}>Loading secure environment...</div>;

  return (
    <div className={styles.layout}>
      <PartnerNotifListener />
      
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#4f46e5' }}>
          <Briefcase className="w-5 h-5" /> GETPartner
        </div>
        <button className={styles.mobileMenuBtn} onClick={() => setSidebarOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Overlay for mobile */}
      <div 
        className={`${styles.overlay} ${sidebarOpen ? styles.overlayOpen : ''}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <Briefcase className="w-6 h-6" /> GETPartner
        </div>
        <nav className={styles.nav}>
          <Link href="/partner/dashboard" className={pathname === '/partner/dashboard' ? styles.active : ''}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/partner/orders" className={pathname === '/partner/orders' || pathname.startsWith('/partner/orders/') ? styles.active : ''}>
            <Package size={18} /> Available Orders
          </Link>
          <Link href="/partner/deliveries" className={pathname === '/partner/deliveries' || pathname.startsWith('/partner/deliveries/') ? styles.active : ''}>
            <Truck size={18} /> My Deliveries
          </Link>
          <Link href="/partner/completed" className={pathname === '/partner/completed' || pathname.startsWith('/partner/completed/') ? styles.active : ''}>
            <CheckSquare size={18} /> Completed
          </Link>
          <Link href="/partner/profile" className={pathname.startsWith('/partner/profile') ? styles.active : ''}>
            <User size={18} /> Profile
          </Link>
        </nav>
        <div className={styles.userProfile}>
          <p className={styles.userName}>{user.name}</p>
          <p className={styles.userRole}>{user.role.replace('_', ' ')}</p>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        {/* Top Navbar */}
        <header className="header-responsive">
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {pathname.includes('/orders') ? 'My Orders' : 
               pathname.includes('/profile') ? 'Profile Settings' :
               'Dashboard Summary'}
            </h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
              {pathname.includes('/orders') ? 'View and manage your assigned delivery requests' : 
               pathname.includes('/profile') ? 'Manage your account and preferences' :
               'Overview of your delivery requests and performance'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{user.name}</span>
              <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{user.role.replace(/_/g, ' ').toLowerCase()}</span>
            </div>
            <NotificationBell />
          </div>
        </header>
        
        <main className={styles.mainContent} style={{ overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
