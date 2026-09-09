'use client';
import { useEffect, useState } from 'react';
import styles from '../../admin/admin.module.css';
import { Building2, Briefcase, Clock, CheckCircle2, AlertCircle, Users, TrendingUp, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Link from 'next/link';

export default function PlatformDashboard() {
  const [platform, setPlatform] = useState<any>(null);
  const [pendingTenants, setPendingTenants] = useState<any[]>([]);
  const [pendingPartners, setPendingPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch platform stats
    fetch('/api/reports/dashboard', { headers })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.platform) setPlatform(data.platform); })
      .catch(console.error);

    // Fetch pending lists for quick-action
    Promise.all([
      fetch('/api/tenants', { headers }).then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/partners', { headers }).then(r => r.ok ? r.json() : { data: [] })
    ]).then(([tRes, pRes]) => {
      setPendingTenants((tRes.data || []).filter((t: any) => t.status === 'PENDING').slice(0, 5));
      setPendingPartners((pRes.data || []).filter((p: any) => p.status === 'PENDING').slice(0, 5));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalPending = (platform?.pendingTenants || 0) + (platform?.pendingPartners || 0);

  const barData = platform ? [
    { name: 'Active\nTenants', value: platform.activeTenants, color: '#3b82f6' },
    { name: 'Pending\nTenants', value: platform.pendingTenants, color: '#f59e0b' },
    { name: 'Active\nPartners', value: platform.activePartners, color: '#10b981' },
    { name: 'Pending\nPartners', value: platform.pendingPartners, color: '#ef4444' },
  ] : [];

  return (
    <div>
      {/* Stat Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>

        {/* Total Tenants */}
        <div className={styles.card} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Registered Businesses</span>
            <div style={{ background: '#dbeafe', borderRadius: '8px', padding: '6px' }}><Building2 size={16} color="#3b82f6" /></div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{loading ? '–' : platform?.totalTenants ?? 0}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
              {loading ? '–' : platform?.activeTenants ?? 0} Active
            </span>
            {platform?.pendingTenants > 0 && (
              <span style={{ fontSize: '12px', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                {platform.pendingTenants} Pending
              </span>
            )}
          </div>
        </div>

        {/* Total Partners */}
        <div className={styles.card} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Delivery Partners</span>
            <div style={{ background: '#d1fae5', borderRadius: '8px', padding: '6px' }}><Briefcase size={16} color="#10b981" /></div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{loading ? '–' : platform?.totalPartners ?? 0}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
              {loading ? '–' : platform?.activePartners ?? 0} Active
            </span>
            {platform?.pendingPartners > 0 && (
              <span style={{ fontSize: '12px', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                {platform.pendingPartners} Pending
              </span>
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className={styles.card} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: totalPending > 0 ? '1px solid #fde68a' : undefined, background: totalPending > 0 ? '#fffbeb' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Pending Approvals</span>
            <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '6px' }}><Clock size={16} color="#d97706" /></div>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: totalPending > 0 ? '#d97706' : '#0f172a', lineHeight: 1 }}>{loading ? '–' : totalPending}</div>
          <Link href="/platform-admin/approvals" style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>
            {totalPending > 0 ? '→ Review Now' : '→ View Approvals'}
          </Link>
        </div>

      </div>

      {/* Main content: Bar chart + Pending quick list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px' }}>

        {/* Bar Chart: Platform Overview */}
        <div className={styles.card} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <TrendingUp size={18} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Platform Overview</h3>
          </div>
          {barData.length > 0 ? (
            <div style={{ height: '260px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} barSize={40}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {barData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Activity size={40} style={{ opacity: 0.4 }} />
            </div>
          )}
        </div>

        {/* Pending Approvals Quick Panel */}
        <div className={styles.card} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} color="#d97706" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Needs Approval</h3>
            </div>
            <Link href="/platform-admin/approvals" style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
          </div>

          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: '14px' }}>Loading...</div>
          ) : (pendingTenants.length === 0 && pendingPartners.length === 0) ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#94a3b8', textAlign: 'center', padding: '24px' }}>
              <CheckCircle2 size={36} color="#16a34a" style={{ opacity: 0.6 }} />
              <p style={{ margin: 0, fontSize: '14px' }}>All caught up! No pending approvals.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
              {pendingTenants.map((t: any) => (
                <div key={`t-${t.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ background: '#dbeafe', borderRadius: '6px', padding: '4px' }}><Building2 size={13} color="#3b82f6" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Business Tenant</div>
                  </div>
                  <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '999px', fontWeight: 700, whiteSpace: 'nowrap' }}>PENDING</span>
                </div>
              ))}
              {pendingPartners.map((p: any) => (
                <div key={`p-${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ background: '#d1fae5', borderRadius: '6px', padding: '4px' }}><Briefcase size={13} color="#10b981" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.companyName}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Delivery Partner</div>
                  </div>
                  <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', padding: '2px 6px', borderRadius: '999px', fontWeight: 700, whiteSpace: 'nowrap' }}>PENDING</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
