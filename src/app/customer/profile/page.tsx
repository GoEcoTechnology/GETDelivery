'use client';
import { User, Settings, MapPin, CreditCard, Bell, HelpCircle, LogOut, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function CustomerProfilePage() {
  return (
    <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '120px', marginTop: '24px' }}>
      
      {/* Header Profile Section */}
      <div style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #081A36 100%)',
        borderRadius: '20px',
        padding: '32px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '256px', height: '256px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', filter: 'blur(40px)', transform: 'translate(30%, -50%)' }}></div>
        
        <div style={{ width: '80px', height: '80px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.5)', zIndex: 10, backdropFilter: 'blur(4px)', flexShrink: 0 }}>
          <User size={36} color="#fff" />
        </div>
        
        <div style={{ flex: 1, zIndex: 10 }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>John Doe</h1>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: '15px', margin: '4px 0 0 0' }}>johndoe@example.com</p>
        </div>
        
        <button style={{ padding: '12px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', zIndex: 10, backdropFilter: 'blur(4px)', color: '#fff' }}>
          <Settings size={22} />
        </button>
      </div>

      {/* Quick Stats / Wallet */}
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
      }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>My Wallet</span>
        <span style={{ color: '#0f172a', fontSize: '28px', fontWeight: 800, marginTop: '4px' }}>₱0.00</span>
      </div>

      {/* Main Menu Options */}
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden'
      }}>
        <Link href="/customer/profile" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderBottom: '1px solid #e2e8f0', textDecoration: 'none', transition: 'background 0.2s', background: 'transparent' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <User size={20} />
          </div>
          <span style={{ flex: 1, color: '#0f172a', fontWeight: 700, fontSize: '16px' }}>Account Information</span>
          <ChevronRight size={20} color="#94a3b8" />
        </Link>
        
        <Link href="/customer/profile" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderBottom: '1px solid #e2e8f0', textDecoration: 'none', transition: 'background 0.2s', background: 'transparent' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
            <MapPin size={20} />
          </div>
          <span style={{ flex: 1, color: '#0f172a', fontWeight: 700, fontSize: '16px' }}>My Addresses</span>
          <ChevronRight size={20} color="#94a3b8" />
        </Link>
        
        {/* Payment Methods removed per request */}
        
        <Link href="/customer/profile" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', textDecoration: 'none', transition: 'background 0.2s', background: 'transparent' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea' }}>
            <Bell size={20} />
          </div>
          <span style={{ flex: 1, color: '#0f172a', fontWeight: 700, fontSize: '16px' }}>Notification Settings</span>
          <ChevronRight size={20} color="#94a3b8" />
        </Link>
      </div>

      <div style={{
        background: '#fff',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden'
      }}>
        <Link href="/customer/profile" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderBottom: '1px solid #e2e8f0', textDecoration: 'none', transition: 'background 0.2s', background: 'transparent' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ccfbf1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d9488' }}>
            <HelpCircle size={20} />
          </div>
          <span style={{ flex: 1, color: '#0f172a', fontWeight: 700, fontSize: '16px' }}>Help Center</span>
          <ChevronRight size={20} color="#94a3b8" />
        </Link>
        
        <button style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s', background: 'transparent' }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            <LogOut size={20} />
          </div>
          <span style={{ flex: 1, color: '#ef4444', fontWeight: 700, fontSize: '16px' }}>Log Out</span>
        </button>
      </div>

    </div>
  );
}
