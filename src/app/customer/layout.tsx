'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import styles from './customer.module.css';

import { 
  Home, 
  Search, 
  ShoppingCart, 
  Package, 
  User, 
  Tag, 
  LogOut,
  ShoppingBag,
  Bell,
  Info
} from 'lucide-react';
import NotificationBell from '../admin/NotificationBell';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{name: string, role: string} | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // For now, try to load user, but don't strictly block if we want to preview
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {}
    } else {
      // Mock user for UI purposes if not logged in (since we are testing UI)
      setUser({ name: 'Guest User', role: 'CUSTOMER' });
    }
  }, []);

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

  const isActive = (path: string) => {
    if (path === '/customer' && pathname === '/customer') return true;
    if (path !== '/customer' && pathname.startsWith(path)) return true;
    return false;
  };

  if (!user) return <div className={styles.loading}>Loading customer portal...</div>;

  return (
    <div className={styles.layout}>
      
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#4f46e5' }}>
          <ShoppingBag className="w-5 h-5" /> GETDelivery
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

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand} style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <ShoppingBag className="w-6 h-6 text-[#4f46e5]" /> GETDelivery
        </div>
        <nav className={styles.nav}>
          <Link href="/customer" className={pathname === '/customer' ? styles.active : ''}>
            <Home size={18} /> Dashboard
          </Link>
          <Link href="/customer/marketplace" className={pathname.startsWith('/customer/marketplace') ? styles.active : ''}>
            <Search size={18} /> Marketplace
          </Link>
          <Link href="/customer/cart" className={pathname.startsWith('/customer/cart') ? styles.active : ''}>
            <ShoppingCart size={18} /> Cart
          </Link>
          <Link href="/customer/orders" className={pathname.startsWith('/customer/orders') ? styles.active : ''}>
            <Package size={18} /> My Orders
          </Link>
          <Link href="/customer/profile" className={pathname.startsWith('/customer/profile') ? styles.active : ''}>
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
      
      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        
        {/* Top Navbar */}
        <header className="header-responsive hide-on-mobile">
          <div>
            <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
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
            <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>
              {(() => {
                const segments = pathname.split('/').filter(Boolean);
                const nameSegments = segments.filter(s => isNaN(Number(s)) && !s.match(/^[0-9a-fA-F-]{10,}$/));
                const lastSegment = nameSegments.length > 1 ? nameSegments[nameSegments.length - 1] : 'Dashboard';
                
                if (lastSegment === 'marketplace') return 'Discover products and exclusive deals';
                if (lastSegment === 'cart') return 'Review your items before checkout';
                if (lastSegment === 'checkout') return 'Complete your order';
                if (lastSegment === 'orders') return 'Track and manage your orders';
                if (lastSegment === 'profile') return 'Manage your account and addresses';
                return 'Welcome back! Find what you need today.';
              })()}
            </p>
          </div>
          <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
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
