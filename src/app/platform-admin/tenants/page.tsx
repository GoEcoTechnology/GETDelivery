'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../../admin/admin.module.css';
import { Search, Edit2, Trash2, Building2, ChevronLeft, ChevronRight, X, CheckCircle, XCircle } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';

type TenantRow = {
  id: number;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  status: string;
};

type TenantEdit = TenantRow & {
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
};

type TenantCreate = {
  name: string;
  contactPerson: string;
  email: string;
  password: string;
};

export default function TenantsPage() {
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [limit] = useState(7);
  const [search, setSearch] = useState('');
  
  const [editModal, setEditModal] = useState<TenantEdit | null>(null);
  const [addModal, setAddModal] = useState(false);
  
  const [newName, setNewName] = useState('');
  const [newContactPerson, setNewContactPerson] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { data } = useQuery({
    queryKey: ['tenants', page, limit, search],
    queryFn: async () => {
      const res = await fetch(`/api/tenants?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch tenants');
      return res.json();
    }
  });

  const tenants = data?.data || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const getToken = () => localStorage.getItem('token') || '';

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tenants/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] })
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tenants'] })
  });

  const updateMutation = useMutation({
    mutationFn: async (tenantData: TenantEdit) => {
      const res = await fetch(`/api/tenants/${tenantData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(tenantData)
      });
      if (!res.ok) throw new Error('Failed to update tenant');
    },
    onSuccess: () => { setEditModal(null); queryClient.invalidateQueries({ queryKey: ['tenants'] }); }
  });

  const addMutation = useMutation({
    mutationFn: async (tenantData: TenantCreate) => {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(tenantData)
      });
      if (!res.ok) throw new Error('Failed to add tenant');
    },
    onSuccess: () => {
      setAddModal(false);
      setNewName(''); setNewContactPerson(''); setNewEmail(''); setNewPassword('');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    }
  });

  const statusColor = (status: string) => {
    if (status === 'ACTIVE') return { bg: '#dcfce7', color: '#15803d' };
    if (status === 'SUSPENDED') return { bg: '#fef2f2', color: '#dc2626' };
    return { bg: '#fef9c3', color: '#a16207' }; // PENDING
  };

  return (
    <div>
      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', minWidth: '200px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by business name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={styles.inputField}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <button onClick={() => setAddModal(true)} className={styles.btnPrimary}>
            <Building2 size={16} /> Register Tenant
          </button>
        </div>

        <div className="table-responsive-wrapper">

          <table className={styles.table}>
          <thead>
            <tr>
              <th>Business Name</th>
              <th>Contact Person</th>
              <th>Owner Email</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No tenants found.</td>
              </tr>
            ) : (
              tenants.map((tenant: TenantRow) => {
                const sc = statusColor(tenant.status);
                return (
                  <tr key={tenant.id}>
                    <td style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>{tenant.name}</td>
                    <td style={{ color: '#475569', fontSize: '14px' }}>{tenant.contactPerson || 'N/A'}</td>
                    <td style={{ color: '#475569', fontSize: '14px' }}>{tenant.email || 'N/A'}</td>
                    <td>
                      <span style={{ padding: '4px 10px', backgroundColor: sc.bg, color: sc.color, borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                        {tenant.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <ActionMenu actions={[
                        ...(tenant.status === 'PENDING' ? [
                          {
                            label: 'Approve',
                            icon: <CheckCircle size={14} />,
                            onClick: () => updateStatusMutation.mutate({ id: tenant.id, status: 'ACTIVE' }),
                            color: '#16a34a'
                          },
                          {
                            label: 'Reject',
                            icon: <XCircle size={14} />,
                            onClick: () => updateStatusMutation.mutate({ id: tenant.id, status: 'SUSPENDED' }),
                            color: '#dc2626'
                          }
                        ] : []),
                        {
                          label: 'Edit',
                          icon: <Edit2 size={14} />,
                          onClick: () => setEditModal(tenant as TenantEdit),
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 size={14} />,
                          onClick: () => {
                            if (confirm('Are you sure you want to delete this tenant? This will wipe out their data.')) {
                              deleteMutation.mutate(tenant.id);
                            }
                          },
                          color: '#ef4444'
                        }
                      ]} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        </div>

        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page === 1 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Add Modal */}
      {addModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Register Business Tenant</h2>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <form
              autoComplete="off"
              onSubmit={(e) => { e.preventDefault(); addMutation.mutate({ name: newName, contactPerson: newContactPerson, email: newEmail, password: newPassword }); }}
            >
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Business Name</label>
                <input autoComplete="off" required className={styles.inputField} type="text" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Contact Person</label>
                <input autoComplete="off" required className={styles.inputField} type="text" value={newContactPerson} onChange={e => setNewContactPerson(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Owner Email</label>
                <input autoComplete="off" required className={styles.inputField} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Owner Password</label>
                <input autoComplete="new-password" required minLength={6} className={styles.inputField} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAddModal(false)} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Register Tenant</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Edit Tenant</h2>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); if (editModal) updateMutation.mutate(editModal); }}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Business Name</label>
                <input required className={styles.inputField} type="text" value={editModal.name} onChange={e => setEditModal({...editModal, name: e.target.value})} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Contact Person</label>
                <input className={styles.inputField} type="text" value={editModal.contactPerson || ''} onChange={e => setEditModal({...editModal, contactPerson: e.target.value})} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Email</label>
                <input className={styles.inputField} type="email" value={editModal.email || ''} onChange={e => setEditModal({...editModal, email: e.target.value})} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>Status</label>
                <select className={styles.inputField} value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value as TenantEdit['status']})}>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditModal(null)} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
