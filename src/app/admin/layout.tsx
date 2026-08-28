'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './admin.module.css';

import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  BarChart3, 
  Users, 
  Car, 
  LogOut,
  Bell,
  Activity,
  Settings
} from 'lucide-react';
import AdminNotifListener from './AdminNotifListener';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{name: string, role: string, tenantId: number} | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(userData));
  }, [router]);


  useEffect(() => {
    // Close sidebar on navigation
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = async () => {

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  if (!user) return <div className={styles.loading}>Loading secure environment...</div>;

  return (
    <div className={styles.layout}>
      <AdminNotifListener />
      
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#4f46e5' }}>
          <Package className="w-5 h-5" /> GETDelivery
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
          <Package className="w-6 h-6" /> GETDelivery
        </div>
        <nav className={styles.nav}>
          <Link href="/admin/dashboard" className={pathname === '/admin/dashboard' ? styles.active : ''}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/admin/inventory" className={pathname.startsWith('/admin/inventory') ? styles.active : ''}>
            <Package size={18} /> Inventory
          </Link>
          <Link href="/admin/deliveries" className={pathname.startsWith('/admin/deliveries') ? styles.active : ''}>
            <Truck size={18} /> Deliveries
          </Link>

          <Link href="/admin/customers" className={pathname.startsWith('/admin/customers') ? styles.active : ''}>
            <Users size={18} /> Customers
          </Link>
          <Link href="/admin/reports" className={pathname.startsWith('/admin/reports') ? styles.active : ''}>
            <BarChart3 size={18} /> Reports
          </Link>
          
          <div style={{ marginTop: '16px', marginBottom: '4px', paddingLeft: '16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fleet
          </div>
          <Link href="/admin/drivers" className={pathname.startsWith('/admin/drivers') ? styles.active : ''}>
            <Users size={18} /> Drivers
          </Link>
          <Link href="/admin/vehicles" className={pathname.startsWith('/admin/vehicles') ? styles.active : ''}>
            <Car size={18} /> Vehicles
          </Link>

          <div style={{ marginTop: '16px', marginBottom: '4px', paddingLeft: '16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            System
          </div>
          <Link href="/admin/notifications" className={pathname.startsWith('/admin/notifications') ? styles.active : ''}>
            <Bell size={18} /> Notifications
          </Link>
          <Link href="/admin/audit-logs" className={pathname.startsWith('/admin/audit-logs') ? styles.active : ''}>
            <Activity size={18} /> Audit Logs
          </Link>
          <Link href="/admin/settings" className={pathname.startsWith('/admin/settings') ? styles.active : ''}>
            <Settings size={18} /> Settings
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
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
