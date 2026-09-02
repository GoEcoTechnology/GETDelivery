'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from '../admin/admin.module.css'; // Reusing admin styles

import { 
  LayoutDashboard, 
  Building2, 
  Briefcase,
  Receipt,
  LogOut,
  Shield
} from 'lucide-react';
import NotificationBell from '../admin/NotificationBell';
export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{name: string, role: string} | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (parsedUser.role !== 'PLATFORM_OWNER') {
      router.push('/login');
      return;
    }
    setUser(parsedUser);
  }, [router]);

  const handleLogout = async () => {

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  if (!user) return <div className={styles.loading}>Loading secure environment...</div>;

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Shield className="w-6 h-6" /> GETPlatform
        </div>
        <nav className={styles.nav}>
          <Link href="/platform-admin/dashboard" className={pathname === '/platform-admin/dashboard' ? styles.active : ''}>
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <div style={{ marginTop: '16px', marginBottom: '4px', paddingLeft: '16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Management
          </div>
          <Link href="/platform-admin/approvals" className={pathname.startsWith('/platform-admin/approvals') ? styles.active : ''}>
            <Shield size={18} /> Approvals
          </Link>
          <Link href="/platform-admin/tenants" className={pathname.startsWith('/platform-admin/tenants') ? styles.active : ''}>
            <Building2 size={18} /> Tenants
          </Link>
          <Link href="/platform-admin/partners" className={pathname.startsWith('/platform-admin/partners') ? styles.active : ''}>
            <Briefcase size={18} /> Delivery Partners
          </Link>
          <Link href="/platform-admin/delivery-pricing" className={pathname.startsWith('/platform-admin/delivery-pricing') ? styles.active : ''}>
            <Receipt size={18} /> Delivery Pricing
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
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', zIndex: 5 }}>
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {pathname.includes('/tenants') ? 'Tenant Management' : 
               pathname.includes('/approvals') ? 'Pending Approvals' : 
               pathname.includes('/partners') ? 'Delivery Partners' : 
               'Platform Dashboard'}
            </h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
              {pathname.includes('/tenants') ? 'Manage all registered businesses on the platform' : 
               pathname.includes('/approvals') ? 'Review and approve new tenant registrations' : 
               pathname.includes('/partners') ? 'Manage platform delivery partners' : 
               'Overview of platform activity'}
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
