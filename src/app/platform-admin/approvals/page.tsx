'use client';

import { useEffect, useState } from 'react';
import styles from '../../admin/admin.module.css';
import { Check, X, Building2, Briefcase, Clock, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Tab = 'tenants' | 'partners';

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('tenants');
  const [pendingTenants, setPendingTenants] = useState<any[]>([]);
  const [pendingPartners, setPendingPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<number | null>(null);
  const router = useRouter();

  const fetchPending = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [tenantsRes, partnersRes] = await Promise.all([
        fetch('/api/tenants', { headers }),
        fetch('/api/partners', { headers })
      ]);
      if (tenantsRes.ok) {
        const { data: tData } = await tenantsRes.json();
        setPendingTenants((tData || []).filter((t: any) => t.status === 'PENDING'));
      }
      if (partnersRes.ok) {
        const { data: pData } = await partnersRes.json();
        setPendingPartners((pData || []).filter((p: any) => p.status === 'PENDING'));
      }
    } catch (error) {
      console.error('Failed to load approvals data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleUpdateTenant = async (id: number, status: string) => {
    setActing(id);
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) { await fetchPending(); router.refresh(); }
    } catch (e) { console.error(e); }
    setActing(null);
  };

  const handleUpdatePartner = async (id: number, status: string) => {
    setActing(id);
    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) { await fetchPending(); router.refresh(); }
    } catch (e) { console.error(e); }
    setActing(null);
  };

  const filteredTenants = pendingTenants.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPartners = pendingPartners.filter(p =>
    p.companyName?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600,
    fontSize: '14px', border: 'none', transition: 'all 0.15s ease',
    background: activeTab === tab ? '#3b82f6' : 'transparent',
    color: activeTab === tab ? 'white' : '#64748b',
  });

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <Building2 size={15} color="#3b82f6" />
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            Business Tenants:&nbsp;
            <span style={{ color: pendingTenants.length > 0 ? '#d97706' : '#16a34a', fontWeight: 700 }}>
              {pendingTenants.length} pending
            </span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <Briefcase size={15} color="#10b981" />
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            Delivery Partners:&nbsp;
            <span style={{ color: pendingPartners.length > 0 ? '#d97706' : '#16a34a', fontWeight: 700 }}>
              {pendingPartners.length} pending
            </span>
          </span>
        </div>
      </div>

      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
            <button style={tabStyle('tenants')} onClick={() => setActiveTab('tenants')}>
              <Building2 size={15} />
              Business Tenants
              {pendingTenants.length > 0 && (
                <span style={{ background: activeTab === 'tenants' ? 'rgba(255,255,255,0.3)' : '#fde68a', color: activeTab === 'tenants' ? 'white' : '#92400e', borderRadius: '999px', fontSize: '11px', fontWeight: 700, padding: '1px 7px' }}>
                  {pendingTenants.length}
                </span>
              )}
            </button>
            <button style={tabStyle('partners')} onClick={() => setActiveTab('partners')}>
              <Briefcase size={15} />
              Delivery Partners
              {pendingPartners.length > 0 && (
                <span style={{ background: activeTab === 'partners' ? 'rgba(255,255,255,0.3)' : '#fde68a', color: activeTab === 'partners' ? 'white' : '#92400e', borderRadius: '999px', fontSize: '11px', fontWeight: 700, padding: '1px 7px' }}>
                  {pendingPartners.length}
                </span>
              )}
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.inputField}
              style={{ paddingLeft: '32px', width: '220px', height: '36px', fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Table */}
        <table className={styles.table} style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '28%', textAlign: 'left' }}>{activeTab === 'tenants' ? 'Business Name' : 'Company Name'}</th>
              <th style={{ width: '25%', textAlign: 'left' }}>Contact Person</th>
              <th style={{ width: '25%', textAlign: 'left' }}>Email / Phone</th>
              <th style={{ width: '12%', textAlign: 'center' }}>Status</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>Loading approvals...</td></tr>
            ) : activeTab === 'tenants' ? (
              filteredTenants.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Clock size={32} style={{ opacity: 0.3 }} />
                    <span>{search ? 'No results found.' : 'No pending business tenant registrations.'}</span>
                  </div>
                </td></tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} style={{ opacity: acting === tenant.id ? 0.5 : 1 }}>
                    <td style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: '#dbeafe', borderRadius: '8px', padding: '6px', flexShrink: 0 }}><Building2 size={14} color="#3b82f6" /></div>
                        <span style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.name}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'left', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tenant.contactPerson || '—'}
                    </td>
                    <td style={{ textAlign: 'left', color: '#475569', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tenant.email || tenant.mobileNumber || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>PENDING</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleUpdateTenant(tenant.id, 'ACTIVE')}
                          disabled={acting === tenant.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#dcfce7', color: '#16a34a', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleUpdateTenant(tenant.id, 'INACTIVE')}
                          disabled={acting === tenant.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          <X size={12} /> Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )
            ) : (
              filteredPartners.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Clock size={32} style={{ opacity: 0.3 }} />
                    <span>{search ? 'No results found.' : 'No pending delivery partner registrations.'}</span>
                  </div>
                </td></tr>
              ) : (
                filteredPartners.map((partner) => (
                  <tr key={partner.id} style={{ opacity: acting === partner.id ? 0.5 : 1 }}>
                    <td style={{ textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: '#d1fae5', borderRadius: '8px', padding: '6px', flexShrink: 0 }}><Briefcase size={14} color="#10b981" /></div>
                        <span style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partner.companyName}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'left', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {partner.contactPerson || '—'}
                    </td>
                    <td style={{ textAlign: 'left', color: '#475569', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {partner.email || partner.mobileNumber || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>PENDING</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleUpdatePartner(partner.id, 'ACTIVE')}
                          disabled={acting === partner.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#dcfce7', color: '#16a34a', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleUpdatePartner(partner.id, 'INACTIVE')}
                          disabled={acting === partner.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', borderRadius: '7px', border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                        >
                          <X size={12} /> Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
