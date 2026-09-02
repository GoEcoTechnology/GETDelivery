'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import styles from '../admin.module.css';
import { User, Building2, Users, Lock, Save, Trash2, Plus, Paintbrush, SlidersHorizontal, Upload } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';

type TabKey = 'profile' | 'team' | 'branding' | 'system';
type TeamMember = {
  id: number;
  firstName?: string;
  lastName?: string;
  name?: string;
  contactNumber?: string;
  email: string;
  role: string;
  status: string;
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', role: '', tenantName: '' });
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });
  const [teamLoading, setTeamLoading] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '', contactNumber: '', password: '', role: 'EMPLOYEE' });

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
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProfile();
      fetchTeam();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProfile, fetchTeam]);

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
      const payload: { name: string; businessName: string; password?: string } = { name: profileData.name, businessName: profileData.tenantName };
      if (passwordEntered) payload.password = passwordData.password;
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
        setNewUser({ firstName: '', lastName: '', email: '', contactNumber: '', password: '', role: 'EMPLOYEE' });
        fetchTeam();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create employee');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to revoke access for this employee?')) return;
    const res = await fetch(`/api/settings/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    if (res.ok) fetchTeam();
  };

  if (profileLoading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Settings...</div>;

  const tabs = [
    { key: 'profile' as const, label: 'My Profile', icon: User },
    { key: 'team' as const, label: 'Team Management', icon: Users, show: profileData.role === 'BUSINESS_OWNER' },
    { key: 'branding' as const, label: 'Company Branding', icon: Paintbrush, show: true },
    { key: 'system' as const, label: 'System Preferences', icon: SlidersHorizontal, show: true }
  ].filter(tab => tab.show !== false);

  return (
    <div>
      <div className={styles.header}>
        <h1>Settings</h1>
        <p>Manage your account, branding, and platform preferences</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        <aside style={{ background: 'rgba(255,255,255,0.8)', borderRadius: '18px', border: '1px solid rgba(226,232,240,0.8)', padding: '12px', boxShadow: '0 10px 30px rgba(15,23,42,0.06)', position: 'sticky', top: '88px' }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  border: 'none',
                  borderRadius: '14px',
                  background: active ? '#eff6ff' : 'transparent',
                  color: active ? '#1d4ed8' : '#475569',
                  cursor: 'pointer',
                  fontWeight: 600,
                  textAlign: 'left',
                  marginBottom: '4px'
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </aside>

        <main style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeTab === 'profile' && (
            <div className={styles.card} style={{ borderRadius: '18px', padding: '24px' }}>
              <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={20} /> Personal Information
              </h3>
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div>
                    <label className={styles.label}>Full Name</label>
                    <input autoComplete="name" className={styles.inputField} value={profileData.name} onChange={e => setProfileData({ ...profileData, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className={styles.label}>Email Address</label>
                    <input autoComplete="off" className={styles.inputField} value={profileData.email} onChange={e => setProfileData({ ...profileData, email: e.target.value })} />
                  </div>
                </div>
                {profileData.role === 'BUSINESS_OWNER' && (
                  <div>
                    <h3 style={{ margin: '24px 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={20} /> Business Information
                    </h3>
                    <div>
                      <label className={styles.label}>Business / Tenant Name</label>
                      <input className={styles.inputField} value={profileData.tenantName} onChange={e => setProfileData({ ...profileData, tenantName: e.target.value })} required />
                    </div>
                  </div>
                )}
                <div>
                  <h3 style={{ margin: '24px 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={20} /> Security
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label className={styles.label}>New Password</label>
                      <input autoComplete="new-password" type="password" className={styles.inputField} value={passwordData.password} onChange={e => setPasswordData({ ...passwordData, password: e.target.value })} />
                    </div>
                    <div>
                      <label className={styles.label}>Confirm New Password</label>
                      <input autoComplete="new-password" type="password" className={styles.inputField} value={passwordData.confirmPassword} onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} />
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
            <div className={styles.card} style={{ padding: 0, overflow: 'hidden', borderRadius: '18px' }}>
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
                  <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div><label className={styles.label}>First Name</label><input className={styles.inputField} value={newUser.firstName} onChange={e => setNewUser({ ...newUser, firstName: e.target.value })} required /></div>
                    <div><label className={styles.label}>Last Name</label><input className={styles.inputField} value={newUser.lastName} onChange={e => setNewUser({ ...newUser, lastName: e.target.value })} required /></div>
                    <div><label className={styles.label}>Email Address</label><input type="email" className={styles.inputField} value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required /></div>
                    <div><label className={styles.label}>Contact Number</label><input className={styles.inputField} value={newUser.contactNumber} onChange={e => setNewUser({ ...newUser, contactNumber: e.target.value })} required /></div>
                    <div><label className={styles.label}>Role</label><select className={styles.inputField} value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}><option value="EMPLOYEE">Employee</option><option value="BUSINESS_OWNER">Business Owner / Admin</option></select></div>
                    <div><label className={styles.label}>Temporary Password</label><input type="password" className={styles.inputField} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required minLength={6} /></div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                      <button type="button" onClick={() => setIsAddingUser(false)} className={styles.btnSecondary}>Cancel</button>
                      <button type="submit" className={styles.btnPrimary}>Create Employee</button>
                    </div>
                  </form>
                </div>
              )}
              <table className={styles.table}>
                <thead>
                  <tr><th>Name</th><th>Contact</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {teamLoading ? (
                    <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center' }}>Loading team...</td></tr>
                  ) : team.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No team members found.</td></tr>
                  ) : team.map(member => (
                    <tr key={member.id}>
                      <td><div style={{ fontWeight: 600, color: '#1e293b' }}>{member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.name}</div></td>
                      <td><div style={{ color: '#475569' }}>{member.contactNumber || '-'}</div></td>
                      <td><div style={{ color: '#475569' }}>{member.email}</div></td>
                      <td><div style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px', display: 'inline-block', fontWeight: 600 }}>{member.role.replace('_', ' ')}</div></td>
                      <td><div style={{ fontSize: '12px', padding: '4px 8px', backgroundColor: member.status === 'ACTIVE' ? '#dcfce7' : '#fef2f2', color: member.status === 'ACTIVE' ? '#16a34a' : '#ef4444', borderRadius: '4px', display: 'inline-block', fontWeight: 600 }}>{member.status}</div></td>
                      <td style={{ textAlign: 'right' }}>
                        <ActionMenu actions={[{ label: 'Revoke Access', icon: <Trash2 size={14} />, onClick: () => handleDeleteUser(member.id), color: '#ef4444' }]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'branding' && (
            <SettingsPanel title="Company Branding" description="Upload a logo and shape the visual identity of the admin workspace.">
              <div style={{ display: 'grid', gap: '16px' }}>
                <UploadZone />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <Stat label="Logo" value="Placeholder upload" />
                  <Stat label="Primary color" value="#1d4ed8" />
                  <Stat label="Brand assets" value="Ready for backend" />
                </div>
              </div>
            </SettingsPanel>
          )}

          {activeTab === 'system' && (
            <SettingsPanel title="System Preferences" description="Tune notifications, visibility, and workspace behavior.">
              <div style={{ display: 'grid', gap: '14px' }}>
                <ToggleRow title="Email alerts" description="Send important system updates to administrators." checked />
                <ToggleRow title="Compact tables" description="Use denser data tables for admin-heavy workflows." />
                <ToggleRow title="Auto-refresh dashboards" description="Keep dashboards current while the app is open." checked />
              </div>
            </SettingsPanel>
          )}
        </main>
      </div>
    </div>
  );
}

function SettingsPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className={styles.card} style={{ borderRadius: '18px', padding: '24px' }}>
      <h3 style={{ margin: 0 }}>{title}</h3>
      <p style={{ marginTop: '6px', color: '#64748b', fontSize: '14px' }}>{description}</p>
      <div style={{ marginTop: '20px' }}>{children}</div>
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

function UploadZone() {
  return (
    <div style={{ padding: '24px', borderRadius: '18px', border: '1px dashed #cbd5e1', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <div>
        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Company logo</div>
        <div style={{ color: '#64748b', fontSize: '14px' }}>Drop a file here or click upload to replace the placeholder branding.</div>
      </div>
      <button className={styles.btnSecondary} type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <Upload size={16} /> Upload Logo
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '14px', borderRadius: '14px', background: 'white', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 700 }}>{value}</div>
    </div>
  );
}
