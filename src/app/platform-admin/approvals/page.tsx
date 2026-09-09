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
      // Fetch only PENDING records server-side for performance
      const [tenantsRes, partnersRes] = await Promise.all([
        fetch('/api/tenants?status=PENDING&limit=100', { headers }),
        fetch('/api/partners?status=PENDING&limit=100', { headers })
      ]);
      if (tenantsRes.ok) {
        const { data: tData } = await tenantsRes.json();
        setPendingTenants(tData || []);
      }
      if (partnersRes.ok) {
        const { data: pData } = await partnersRes.json();
        setPendingPartners(pData || []);
      }
    } catch (error) {
      console.error('Failed to load approvals data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleApproveTenant = async (id: number) => {
    setActing(id);
    setPendingTenants(prev => prev.filter(t => t.id !== id)); // Optimistic UI
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'ACTIVE' })
      });
      if (res.ok) { await fetchPending(); router.refresh(); }
    } catch (e) { console.error(e); await fetchPending(); } // Revert on error
    setActing(null);
  };

  const handleDeclineTenant = async (id: number) => {
    setActing(id);
    setPendingTenants(prev => prev.filter(t => t.id !== id)); // Optimistic UI
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/tenants/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { await fetchPending(); router.refresh(); }
    } catch (e) { console.error(e); await fetchPending(); } // Revert on error
    setActing(null);
  };

  const handleApprovePartner = async (id: number) => {
    setActing(id);
    setPendingPartners(prev => prev.filter(p => p.id !== id)); // Optimistic UI
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'ACTIVE' })
      });
      if (res.ok) { await fetchPending(); router.refresh(); }
    } catch (e) { console.error(e); await fetchPending(); } // Revert on error
    setActing(null);
  };

  const handleDeclinePartner = async (id: number) => {
    setActing(id);
    setPendingPartners(prev => prev.filter(p => p.id !== id)); // Optimistic UI
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/partners/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { await fetchPending(); router.refresh(); }
    } catch (e) { console.error(e); await fetchPending(); } // Revert on error
    setActing(null);
  };

  const filteredTenants = pendingTenants.filter(t =>
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.contactPerson?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredPartners = pendingPartners.filter(p =>
    p.companyName?.toLowerCase().includes(search.toLowerCase()) ||
    p.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.contactPerson?.toLowerCase().includes(search.toLowerCase())
  );

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600,
    fontSize: '14px', border: 'none', transition: 'all 0.15s ease', fontFamily: 'inherit',
    background: activeTab === tab ? '#3b82f6' : 'transparent',
    color: activeTab === tab ? 'white' : '#64748b',
  });

  const colStyle: React.CSSProperties = { textAlign: 'left', padding: '12px 16px' };

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
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '25%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '27%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '14%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ ...colStyle, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {activeTab === 'tenants' ? 'Business Name' : 'Company Name'}
              </th>
              <th style={{ ...colStyle, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contact Person</th>
              <th style={{ ...colStyle, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email / Phone</th>
              <th style={{ ...colStyle, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Status</th>
              <th style={{ ...colStyle, fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading approvals...</td></tr>
            ) : activeTab === 'tenants' ? (
              filteredTenants.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Clock size={32} style={{ opacity: 0.3 }} />
                    <span style={{ fontSize: '14px' }}>{search ? 'No results found.' : 'No pending business tenant registrations.'}</span>
                  </div>
                </td></tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: acting === tenant.id ? 0.5 : 1 }}>
                    <td style={{ ...colStyle, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tenant.name}
                    </td>
                    <td style={{ ...colStyle, color: '#475569', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tenant.contactPerson || '—'}
                    </td>
                    <td style={{ ...colStyle, color: '#475569', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tenant.email || '—'}
                    </td>
                    <td style={{ ...colStyle, textAlign: 'center' }}>
                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>PENDING</span>
                    </td>
                    <td style={{ ...colStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleApproveTenant(tenant.id)}
                          disabled={acting === tenant.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '7px', border: 'none', background: '#dcfce7', color: '#16a34a', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleDeclineTenant(tenant.id)}
                          disabled={acting === tenant.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '7px', border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
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
                    <span style={{ fontSize: '14px' }}>{search ? 'No results found.' : 'No pending delivery partner registrations.'}</span>
                  </div>
                </td></tr>
              ) : (
                filteredPartners.map((partner) => (
                  <tr key={partner.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: acting === partner.id ? 0.5 : 1 }}>
                    <td style={{ ...colStyle, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {partner.companyName}
                    </td>
                    <td style={{ ...colStyle, color: '#475569', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {partner.contactPerson || '—'}
                    </td>
                    <td style={{ ...colStyle, color: '#475569', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {partner.email || partner.mobileNumber || '—'}
                    </td>
                    <td style={{ ...colStyle, textAlign: 'center' }}>
                      <span style={{ background: '#fef3c7', color: '#d97706', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>PENDING</span>
                    </td>
                    <td style={{ ...colStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleApprovePartner(partner.id)}
                          disabled={acting === partner.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '7px', border: 'none', background: '#dcfce7', color: '#16a34a', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          <Check size={12} /> Approve
                        </button>
                        <button
                          onClick={() => handleDeclinePartner(partner.id)}
                          disabled={acting === partner.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '7px', border: 'none', background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}
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
