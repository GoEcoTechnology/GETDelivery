'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from '../admin/admin.module.css'; // Reusing admin styles

import { 
  LayoutDashboard, 
  Building2, 
  Briefcase,
  LogOut,
  Shield
} from 'lucide-react';

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

  const handleLogout = () => {
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
          <Link href="/platform-admin/tenants" className={pathname.startsWith('/platform-admin/tenants') ? styles.active : ''}>
            <Building2 size={18} /> Tenants
          </Link>
          <Link href="/platform-admin/partners" className={pathname.startsWith('/platform-admin/partners') ? styles.active : ''}>
            <Briefcase size={18} /> Delivery Partners
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
