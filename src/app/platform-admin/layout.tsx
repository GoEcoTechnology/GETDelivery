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
  Shield,
  X
} from 'lucide-react';
import NotificationBell from '../admin/NotificationBell';
import PageGuideButton from '@/components/PageGuideModal';
export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{name: string, role: string} | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const loadUser = () => {
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
    };

    loadUser();
    window.addEventListener('userUpdated', loadUser);
    return () => window.removeEventListener('userUpdated', loadUser);
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
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#4f46e5' }}>
          <Shield className="w-5 h-5" /> GETPlatform
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <PageGuideButton variant="mobile" />
          <NotificationBell />
          <button onClick={handleLogout} className={styles.mobileLogoutHeaderBtn} title="Sign Out" aria-label="Sign Out">
            <LogOut size={18} />
          </button>
          <button className={styles.mobileMenuBtn} onClick={() => setSidebarOpen(true)} aria-label="Open menu">
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield className="w-6 h-6" /> GETPlatform
          </div>
          <button 
            className={styles.sidebarCloseBtn} 
            onClick={() => setSidebarOpen(false)} 
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
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
          <div style={{ marginTop: '16px', marginBottom: '4px', paddingLeft: '16px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            System
          </div>
          <Link href="/platform-admin/profile" className={pathname.startsWith('/platform-admin/profile') ? styles.active : ''}>
            <Shield size={18} /> Profile
          </Link>
        </nav>
        <div className={styles.userProfile}>
          <p className={styles.userName}>{user.name}</p>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        {/* Top Navbar */}
        <header className="header-responsive hide-on-mobile">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                {(() => {
                  const segments = pathname.split('/').filter(Boolean);
                  const nameSegments = segments.filter(s => isNaN(Number(s)) && !s.match(/^[0-9a-fA-F-]{10,}$/));
                  const lastSegment = nameSegments.length > 1 ? nameSegments[nameSegments.length - 1] : 'Dashboard';
                  if (['admin', 'partner', 'customer', 'platform-admin'].includes(lastSegment.toLowerCase())) {
                    return 'Dashboard';
                  }
                  return lastSegment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                })()}
              </h1>
              <PageGuideButton variant="title" />
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              {(() => {
                const segments = pathname.split('/').filter(Boolean);
                const nameSegments = segments.filter(s => isNaN(Number(s)) && !s.match(/^[0-9a-fA-F-]{10,}$/));
                const lastSegment = nameSegments.length > 1 ? nameSegments[nameSegments.length - 1] : 'Dashboard';
                
                if (lastSegment === 'tenants') return 'Manage all registered businesses on the platform';
                if (lastSegment === 'approvals') return 'Review and approve new tenant registrations';
                if (lastSegment === 'partners') return 'Manage platform delivery partners';
                if (lastSegment === 'delivery-pricing') return 'Configure global settings and rates';
                if (lastSegment === 'profile') return 'Manage your account and platform settings';
                return 'Overview of platform activity';
              })()}
            </p>
          </div>
          <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{user.name}</span>
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
