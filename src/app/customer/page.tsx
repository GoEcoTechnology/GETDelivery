'use client';
import Link from 'next/link';
import { Package, ShoppingCart, Heart, Tag, Store, Search, Clock, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './customer.module.css';

export default function CustomerDashboardPage() {
  const [user, setUser] = useState<{name: string} | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {}
    } else {
      setUser({ name: 'Guest User' });
    }
  }, []);

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      
      {/* Hero Banner (Full width, consistent branding) */}
      <div style={{ 
        position: 'relative', 
        borderRadius: '18px', 
        overflow: 'hidden', 
        background: 'linear-gradient(135deg, #4f46e5 0%, #081A36 100%)', 
        color: 'white', 
        padding: '32px 40px',
        boxShadow: '0 10px 30px rgba(79, 70, 229, 0.15)'
      }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '300px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', filter: 'blur(40px)', transform: 'translate(30%, -30%)' }}></div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '200px', height: '200px', background: 'rgba(79, 70, 229, 0.2)', borderRadius: '50%', filter: 'blur(30px)', transform: 'translate(-20%, 30%)' }}></div>
        
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '800px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 12px 0', letterSpacing: '-0.02em' }}>
            Welcome Back, {user?.name.split(' ')[0]}!
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.9)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            Let's get what you need. Discover exclusive deals from local businesses today.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <Link 
              href="/customer/marketplace" 
              className={styles.btnSecondary}
              style={{ padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#4f46e5', border: 'none', background: 'white' }}
            >
              <Search size={18} /> Browse Products
            </Link>
            <Link 
              href="/customer/orders" 
              className={styles.btnSecondary}
              style={{ padding: '12px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'white', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)' }}
            >
              <Package size={18} /> My Orders
            </Link>
          </div>
        </div>
      </div>

      {/* Dashboard Summary Stats (Exactly matching Partner Layout) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Stat title="Active Orders" value={0} icon={<Clock size={20} color="#94a3b8" />} />
        <Stat title="Items in Cart" value={0} icon={<ShoppingCart size={20} color="#94a3b8" />} />
        <Stat title="Favorite Stores" value={0} icon={<Star size={20} color="#94a3b8" />} />
      </div>

      {/* Quick Actions Grid */}
      <div style={{ display: 'grid', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0f172a' }}>Quick Actions</h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
          {[
            { label: 'Shop', icon: Store, href: '/customer/marketplace' },
            { label: 'My Orders', icon: Package, href: '/customer/orders' },
            { label: 'Cart', icon: ShoppingCart, href: '/customer/cart' },
            { label: 'Favorites', icon: Heart, href: '/customer/profile' },
          ].map((action, i) => (
            <Link 
              key={i} 
              href={action.href}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '24px 16px', 
                background: 'white', 
                borderRadius: '16px', 
                border: '1px solid #e2e8f0', 
                boxShadow: '0 4px 12px rgba(15,23,42,0.02)',
                gap: '12px',
                textDecoration: 'none',
                color: '#0f172a',
                transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(15,23,42,0.05)';
                e.currentTarget.style.borderColor = '#4f46e5';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.02)';
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            >
              <div style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '14px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: 'rgba(79, 70, 229, 0.1)',
                color: '#4f46e5' 
              }}>
                <action.icon size={24} strokeWidth={2.5} />
              </div>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}

function Stat({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div style={{ 
      background: '#fff', 
      borderRadius: '20px', 
      padding: '24px', 
      border: '1px solid #e2e8f0', 
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '16px',
      transition: 'transform 0.2s, box-shadow 0.2s'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>{title}</h3>
        {icon}
      </div>
      <p style={{ color: '#0f172a', fontSize: '32px', fontWeight: 800, margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  );
}
