'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './admin.module.css';

import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  Users, 
  Car, 
  LogOut,
  Settings,
  UserCog,
  Lightbulb,
  X,
  AlertTriangle
} from 'lucide-react';
import AdminNotifListener from './AdminNotifListener';
import NotificationBell from './NotificationBell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{name: string, role: string, tenantId: number} | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => setShowReminderModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lightbulb size={24} color="#f59e0b" />
          </button>
          <NotificationBell />
          <button className={styles.mobileMenuBtn} onClick={() => setSidebarOpen(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
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

          
          <div style={{ marginTop: '16px', marginBottom: '4px', paddingLeft: '16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Team
          </div>
          <Link href="/admin/employees" className={pathname.startsWith('/admin/employees') ? styles.active : ''}>
            <UserCog size={18} /> Employees
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
          <Link href="/admin/profile" className={pathname.startsWith('/admin/profile') ? styles.active : ''}>
            <UserCog size={18} /> Profile
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
        <header className="header-responsive hide-on-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', zIndex: 5 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {(() => {
                if (pathname.startsWith('/admin/inventory')) return 'Inventory Management';
                if (pathname.startsWith('/admin/deliveries')) return 'Deliveries';
                if (pathname.startsWith('/admin/customers')) return 'Customers';
                if (pathname.startsWith('/admin/employees')) return 'Employees';
                if (pathname.startsWith('/admin/drivers')) return 'Drivers';
                if (pathname.startsWith('/admin/vehicles')) return 'Vehicles';
                if (pathname.startsWith('/admin/profile')) return 'Profile Settings';
                return 'Dashboard';
              })()}
            </h1>
          </div>

          <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{user.name}</span>
              <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'capitalize' }}>{user.role.replace(/_/g, ' ').toLowerCase()}</span>
            </div>
            <button onClick={() => setShowReminderModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '50%', backgroundColor: '#fef3c7', boxShadow: '0 2px 5px rgba(245,158,11,0.2)', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
              <Lightbulb size={20} color="#d97706" />
            </button>
            <NotificationBell />
          </div>
        </header>

        <main className={styles.mainContent} style={{ overflowY: 'auto' }}>
          {children}
        </main>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ backgroundColor: '#fef3c7', padding: '10px', borderRadius: '12px' }}>
                  <AlertTriangle size={24} color="#d97706" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Important Reminder</h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>System Data Retention Policy</p>
                </div>
              </div>
              <button onClick={() => setShowReminderModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#334155', lineHeight: '1.6' }}>
                Please be advised that the system automatically clears old records to maintain optimal performance.
              </p>
              
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '14px', lineHeight: '1.6' }}>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Stock History:</strong> Automatically deleted on the last day of every month.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Completed Deliveries:</strong> Automatically deleted on the last day of every month.
                </li>
                <li style={{ marginBottom: '8px' }}>
                  <strong>Important:</strong> Please check your Spam folder for GET DELIVERY messages and do not report them as spam. Turn on notifications for Gmail to ensure you and your delivery partners always receive delivery alerts.
                </li>
              </ul>
            </div>
            
            <div style={{ padding: '16px', backgroundColor: '#ecfdf5', borderRadius: '12px', border: '1px solid #a7f3d0', display: 'flex', gap: '12px' }}>
              <Lightbulb size={20} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '13.5px', color: '#065f46', lineHeight: '1.5', fontWeight: 500 }}>
                We highly recommend exporting any records you need to keep <strong>before</strong> the automatic deletion occurs.
              </p>
            </div>
            
            <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReminderModal(false)} style={{ backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)' }}>
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
