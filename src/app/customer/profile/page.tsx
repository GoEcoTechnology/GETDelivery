'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from '@/app/admin/admin.module.css'; // Re-use the business owner CSS modules
import { User, Lock, MapPin, Save } from 'lucide-react';

type TabKey = 'profile' | 'addresses';

export default function CustomerProfilePage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', contactNumber: '' });
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/profile', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
      if (res.ok) {
        const json = await res.json();
        setProfileData({
          name: json.user.name,
          email: json.user.email || '',
          contactNumber: json.user.contactNumber || '',
        });
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    const passwordEntered = passwordData.password.trim().length > 0;
    const confirmEntered = passwordData.confirmPassword.trim().length > 0;

    if (passwordEntered || confirmEntered) {
      if (!passwordEntered || !confirmEntered) {
        alert('Enter the new password in both fields if you want to change it.');
        setProfileSaving(false);
        return;
      }
      if (passwordData.password !== passwordData.confirmPassword) {
        alert('Passwords do not match');
        setProfileSaving(false);
        return;
      }
    }

    try {
      const payload: any = {
        name: profileData.name,
        contactNumber: profileData.contactNumber
      };

      if (passwordEntered) payload.password = passwordData.password;
      
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Profile saved successfully!');
        setPasswordData({ password: '', confirmPassword: '' });
        
        // Update local storage user info
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          user.name = payload.name;
          localStorage.setItem('user', JSON.stringify(user));
        }

      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save profile');
      }
    } finally {
      setProfileSaving(false);
    }
  };

  if (profileLoading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Profile...</div>;

  const tabs = [
    { key: 'profile' as const, label: 'My Profile', icon: User },
    { key: 'addresses' as const, label: 'My Addresses', icon: MapPin }
  ];

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingTop: '24px', paddingBottom: '120px' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #e2e8f0', marginBottom: '32px' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              color: activeTab === tab.key ? '#4f46e5' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid #4f46e5' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div className={styles.card} style={{ padding: '32px', margin: '0 auto' }}>
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Personal Information */}
            <div>
              <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                <User size={20} /> Personal Information
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label className={styles.label}>Full Name</label>
                  <input 
                    className={styles.inputField} 
                    value={profileData.name} 
                    onChange={e => setProfileData({ ...profileData, name: e.target.value })} 
                    required 
                  />
                </div>
                <div>
                  <label className={styles.label}>Email Address</label>
                  <input 
                    type="email" 
                    className={styles.inputField} 
                    value={profileData.email} 
                    disabled 
                    style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }} 
                  />
                </div>
                <div>
                  <label className={styles.label}>Contact Number</label>
                  <input 
                    type="text" 
                    className={styles.inputField} 
                    value={profileData.contactNumber} 
                    onChange={e => setProfileData({ ...profileData, contactNumber: e.target.value })} 
                    required 
                  />
                </div>
              </div>
            </div>

            {/* Security */}
            <div>
              <h3 style={{ margin: '24px 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
                <Lock size={20} /> Security
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label className={styles.label}>New Password</label>
                  <input 
                    autoComplete="new-password" 
                    type="password" 
                    placeholder="Leave blank to keep current"
                    className={styles.inputField} 
                    value={passwordData.password} 
                    onChange={e => setPasswordData({ ...passwordData, password: e.target.value })} 
                  />
                </div>
                <div>
                  <label className={styles.label}>Confirm New Password</label>
                  <input 
                    autoComplete="new-password" 
                    type="password" 
                    placeholder="Leave blank to keep current"
                    className={styles.inputField} 
                    value={passwordData.confirmPassword} 
                    onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} 
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '24px' }}>
              <button 
                type="submit" 
                disabled={profileSaving}
                style={{
                  background: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '15px',
                  cursor: profileSaving ? 'not-allowed' : 'pointer',
                  opacity: profileSaving ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={e => { if(!profileSaving) e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { if(!profileSaving) e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <Save size={18} /> {profileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'addresses' && (
        <div className={styles.card} style={{ padding: '32px', margin: '0 auto', textAlign: 'center', color: '#64748b' }}>
          <MapPin size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#0f172a' }}>Saved Addresses</h3>
          <p style={{ maxWidth: '400px', margin: '0 auto' }}>
            Addresses are automatically saved when you place an order. You can select them directly during checkout!
          </p>
        </div>
      )}

    </div>
  );
}
