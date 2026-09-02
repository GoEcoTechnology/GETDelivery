'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import styles from '../partner.module.css';
import { User, Bell, Clock3, Layers3 } from 'lucide-react';

type TabKey = 'profile' | 'notifications';
type PartnerUser = { name?: string; email?: string };

export default function PartnerSettings() {
  const [partner, setPartner] = useState<PartnerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace('#', '') as TabKey;
      setActiveTab(hash === 'notifications' ? 'notifications' : 'profile');
    };

    const timer = setTimeout(() => {
      const userStr = localStorage.getItem('user');
      if (userStr) setPartner(JSON.parse(userStr) as PartnerUser);
      setLoading(false);
      syncFromHash();
    }, 0);

    window.addEventListener('hashchange', syncFromHash);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, []);

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div className={styles.pageHeader}>
        <h1>Account Settings</h1>
        <p>Manage your partner profile and preferences</p>
      </div>

      <section style={{ background: 'white', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'start', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#0f172a' }}>
              {activeTab === 'profile' && 'Profile'}
              {activeTab === 'notifications' && 'Notifications'}
            </h2>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '14px' }}>
              {activeTab === 'profile' && 'Your account details and contact information'}
              {activeTab === 'notifications' && 'Choose what delivery updates you want to see'}
            </p>
          </div>
        </div>

        {loading ? (
          <p>Loading settings...</p>
        ) : activeTab === 'profile' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <InfoCard label="Company Name" value={partner?.name || 'Not set'} icon={<Layers3 size={18} />} />
            <InfoCard label="Contact Person" value={partner?.name || 'Not set'} icon={<User size={18} />} />
            <InfoCard label="Email" value={partner?.email || 'Not provided'} icon={<Bell size={18} />} />
            <InfoCard label="Working Hours" value="8:00 AM - 8:00 PM" icon={<Clock3 size={18} />} />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            <ToggleRow title="Request alerts" description="Get notified when a new delivery request arrives." checked />
            <ToggleRow title="Dispatch reminders" description="Receive reminders for ready-for-dispatch deliveries." checked />
            <ToggleRow title="Status updates" description="Hear about assignment, delivery, and cancellation updates." />
          </div>
        )}
      </section>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div style={{ padding: '16px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2563eb', fontWeight: 700, fontSize: '13px', marginBottom: '10px' }}>
        {icon}
        {label}
      </div>
      <div style={{ color: '#0f172a', fontSize: '15px', fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function ToggleRow({ title, description, checked = false }: { title: string; description: string; checked?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '16px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div>
        <div style={{ fontWeight: 700, color: '#0f172a' }}>{title}</div>
        <div style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>{description}</div>
      </div>
      <div style={{ width: '44px', height: '26px', borderRadius: '999px', background: checked ? '#2563eb' : '#cbd5e1', padding: '3px', display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start' }}>
        <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%' }} />
      </div>
    </div>
  );
}
