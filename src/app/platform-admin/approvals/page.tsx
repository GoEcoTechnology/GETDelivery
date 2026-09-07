'use client';

import { useEffect, useState } from 'react';
import styles from '../../admin/admin.module.css';
import { ActionMenu } from '@/components/ActionMenu';
import { Check, X, Building2, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ApprovalsPage() {
  const [pendingTenants, setPendingTenants] = useState<any[]>([]);
  const [pendingPartners, setPendingPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchPending();
  }, []);

  const handleUpdateTenant = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/tenants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchPending();
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePartner = async (id: number, status: string) => {
    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchPending();
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Pending Tenants */}
        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Building2 size={20} color="#3b82f6" />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Business Tenants ({pendingTenants.length})</h2>
          </div>
          
          {loading ? (
            <p>Loading...</p>
          ) : pendingTenants.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
              No pending tenant registrations.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingTenants.map((tenant) => (
                <div key={tenant.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{tenant.name}</h3>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>{tenant.email}</p>
                  </div>
                  <ActionMenu 
                    actions={[
                      {
                        label: 'Approve',
                        icon: <Check size={16} />,
                        onClick: () => handleUpdateTenant(tenant.id, 'ACTIVE')
                      },
                      {
                        label: 'Decline',
                        icon: <X size={16} />,
                        onClick: () => handleUpdateTenant(tenant.id, 'INACTIVE')
                      }
                    ]}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Partners */}
        <div className={styles.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Briefcase size={20} color="#10b981" />
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Delivery Partners ({pendingPartners.length})</h2>
          </div>
          
          {loading ? (
            <p>Loading...</p>
          ) : pendingPartners.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
              No pending delivery partner registrations.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingPartners.map((partner) => (
                <div key={partner.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>{partner.companyName}</h3>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>{partner.email}</p>
                  </div>
                  <ActionMenu 
                    actions={[
                      {
                        label: 'Approve',
                        icon: <Check size={16} />,
                        onClick: () => handleUpdatePartner(partner.id, 'ACTIVE')
                      },
                      {
                        label: 'Decline',
                        icon: <X size={16} />,
                        onClick: () => handleUpdatePartner(partner.id, 'INACTIVE')
                      }
                    ]}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
