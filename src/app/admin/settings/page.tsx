'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../admin.module.css';
import { User, Building, Users, Lock, Save, Trash2, Edit2, X, Plus } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile State
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', role: '', tenantName: '' });
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });

  // Team State
  const [teamLoading, setTeamLoading] = useState(false);
  const [team, setTeam] = useState<any[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' });

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/profile', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
      if (res.ok) {
        const json = await res.json();
        setProfileData({
          name: json.user.name,
          email: json.user.email,
          role: json.user.role,
          tenantName: json.tenant?.name || ''
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const fetchTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const res = await fetch('/api/settings/users', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
      if (res.ok) {
        const json = await res.json();
        setTeam(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchTeam();
  }, [fetchProfile, fetchTeam]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    
    if (passwordData.password && passwordData.password !== passwordData.confirmPassword) {
      alert('Passwords do not match');
      setProfileSaving(false);
      return;
    }

    try {
      const payload: any = { name: profileData.name, businessName: profileData.tenantName };
      if (passwordData.password) payload.password = passwordData.password;

      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert('Profile saved successfully!');
        setPasswordData({ password: '', confirmPassword: '' });
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save profile');
      }
    } catch (e) {
      alert('Network error');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.password.length < 6) return alert('Password must be at least 6 characters');
    
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        alert('Employee created successfully!');
        setIsAddingUser(false);
        setNewUser({ name: '', email: '', password: '' });
        fetchTeam();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create employee');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to revoke access for this employee?')) return;
    try {
      const res = await fetch(`/api/settings/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        fetchTeam();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  if (profileLoading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Settings...</div>;

  return (
    <div>
      <div className={styles.header}>
        <h1>Settings</h1>
        <p>Manage your account and business preferences</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* Sidebar Nav */}
        <div className={styles.card} style={{ flex: '0 0 250px', padding: '12px' }}>
          <button 
            onClick={() => setActiveTab('profile')}
            style={{ ...tabStyle, ...(activeTab === 'profile' ? activeTabStyle : {}) }}
          >
            <User size={18} /> My Profile
          </button>
          
          {profileData.role === 'BUSINESS_OWNER' && (
            <button 
              onClick={() => setActiveTab('team')}
              style={{ ...tabStyle, ...(activeTab === 'team' ? activeTabStyle : {}) }}
            >
              <Users size={18} /> Team Management
            </button>
          )}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1 }}>
          {activeTab === 'profile' && (
            <div className={styles.card}>
              <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={20} /> Personal Information
              </h3>
              
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label className={styles.label}>Full Name</label>
                    <input 
                      className={styles.inputField} 
                      value={profileData.name} 
                      onChange={e => setProfileData({...profileData, name: e.target.value})} 
                      required 
                    />
                  </div>
                  <div>
                    <label className={styles.label}>Email Address (Read-only)</label>
                    <input className={styles.inputField} value={profileData.email} disabled style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} />
                  </div>
                </div>

                {profileData.role === 'BUSINESS_OWNER' && (
                  <div>
                    <h3 style={{ margin: '24px 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building size={20} /> Business Information
                    </h3>
                    <div>
                      <label className={styles.label}>Business / Tenant Name</label>
                      <input 
                        className={styles.inputField} 
                        value={profileData.tenantName} 
                        onChange={e => setProfileData({...profileData, tenantName: e.target.value})} 
                        required 
                      />
                    </div>
                  </div>
                )}

                <div>
                  <h3 style={{ margin: '24px 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={20} /> Security
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label className={styles.label}>New Password (Leave blank to keep current)</label>
                      <input 
                        type="password"
                        className={styles.inputField} 
                        value={passwordData.password} 
                        onChange={e => setPasswordData({...passwordData, password: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className={styles.label}>Confirm New Password</label>
                      <input 
                        type="password"
                        className={styles.inputField} 
                        value={passwordData.confirmPassword} 
                        onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: '16px', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className={styles.btnPrimary} disabled={profileSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Save size={18} /> {profileSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'team' && profileData.role === 'BUSINESS_OWNER' && (
            <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Team Management</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>Manage employee access to your inventory and deliveries.</p>
                </div>
                <button onClick={() => setIsAddingUser(true)} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={16} /> Add Employee
                </button>
              </div>

              {isAddingUser && (
                <div style={{ padding: '24px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                    <div style={{ flex: 1 }}>
                      <label className={styles.label}>Name</label>
                      <input className={styles.inputField} required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className={styles.label}>Email</label>
                      <input type="email" className={styles.inputField} required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className={styles.label}>Password</label>
                      <input type="password" minLength={6} className={styles.inputField} required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="submit" className={styles.btnPrimary}>Create</button>
                      <button type="button" onClick={() => setIsAddingUser(false)} className={styles.btnSecondary} style={{ padding: '10px' }}><X size={20} /></button>
                    </div>
                  </form>
                </div>
              )}

              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamLoading ? (
                    <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center' }}>Loading team...</td></tr>
                  ) : team.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No employees found.</td></tr>
                  ) : (
                    team.map(member => (
                      <tr key={member.id}>
                        <td style={{ fontWeight: 600 }}>{member.name}</td>
                        <td style={{ color: '#475569' }}>{member.email}</td>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', backgroundColor: member.role === 'BUSINESS_OWNER' ? '#fef3c7' : '#e0e7ff', color: member.role === 'BUSINESS_OWNER' ? '#d97706' : '#4338ca' }}>
                            {member.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', backgroundColor: member.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: member.status === 'ACTIVE' ? '#166534' : '#991b1b' }}>
                            {member.status}
                          </span>
                        </td>
                        <td>
                          {member.role !== 'BUSINESS_OWNER' && (
                            <button onClick={() => handleDeleteUser(member.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                              <Trash2 size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const tabStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 16px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: '8px',
  color: '#64748b',
  fontWeight: 600,
  fontSize: '14px',
  textAlign: 'left' as const,
  transition: 'all 0.2s'
};

const activeTabStyle = {
  background: '#eff6ff',
  color: '#2563eb'
};
