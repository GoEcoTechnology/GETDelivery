'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../../admin/admin.module.css';
import { Search, Edit2, Trash2, Building2, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function TenantsPage() {
  const queryClient = useQueryClient();
  
  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  
  // Modals
  const [editModal, setEditModal] = useState<any>(null);
  const [addModal, setAddModal] = useState(false);
  
  // New Tenant State
  const [newName, setNewName] = useState('');
  const [newPlan, setNewPlan] = useState('FREE');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const { data, isLoading: loading } = useQuery({
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

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/tenants/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to delete tenant');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    }
  });

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this tenant? This will wipe out their data.')) return;
    deleteMutation.mutate(id);
  };

  const updateMutation = useMutation({
    mutationFn: async (tenantData: any) => {
      const res = await fetch(`/api/tenants/${tenantData.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(tenantData)
      });
      if (!res.ok) throw new Error('Failed to update tenant');
    },
    onSuccess: () => {
      setEditModal(null);
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    }
  });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    updateMutation.mutate(editModal);
  };

  const addMutation = useMutation({
    mutationFn: async (tenantData: any) => {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(tenantData)
      });
      if (!res.ok) throw new Error('Failed to add tenant');
    },
    onSuccess: () => {
      setAddModal(false);
      setNewName('');
      setNewPlan('FREE');
      setNewEmail('');
      setNewPassword('');
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    }
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate({ name: newName, subscriptionPlan: newPlan, email: newEmail, password: newPassword });
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Tenant Management</h1>
          <p>Manage all registered businesses on the platform</p>
        </div>
        <button onClick={() => setAddModal(true)} className={styles.btnPrimary}>
          <Building2 size={16} /> Register Tenant
        </button>
      </div>

      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        
        {/* Toolbar */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
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
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            Total: {totalCount} tenants
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Business Name</th>
              <th>Owner Email</th>
              <th>Subscription Plan</th>
              <th>Status</th>
              <th>Created At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No tenants found.
                </td>
              </tr>
            ) : (
              tenants.map((tenant: any) => (
                <tr key={tenant.id}>
                  <td style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>{tenant.name}</td>
                  <td style={{ color: '#475569', fontSize: '14px' }}>{tenant.email || 'N/A'}</td>
                  <td>
                    <span style={{ padding: '4px 8px', backgroundColor: tenant.subscriptionPlan === 'ENTERPRISE' ? '#f5f3ff' : '#f1f5f9', color: tenant.subscriptionPlan === 'ENTERPRISE' ? '#7c3aed' : '#475569', borderRadius: '6px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' }}>
                      {tenant.subscriptionPlan}
                    </span>
                  </td>
                  <td>
                    {tenant.status === 'ACTIVE' 
                      ? <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                      : <span className={`${styles.badge} ${styles.badgeError}`}>Suspended</span>
                    }
                  </td>
                  <td style={{ color: '#64748b', fontSize: '13px' }}>
                    {new Date(tenant.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => setEditModal(tenant)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '8px' }}>
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(tenant.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Page {page} of {totalPages || 1}</span>
          <button 
            disabled={page >= totalPages} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}
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
            
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Business Name</label>
                <input required className={styles.inputField} type="text" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Owner Email</label>
                <input required className={styles.inputField} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Owner Password</label>
                <input required minLength={6} className={styles.inputField} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>Subscription Plan</label>
                <select className={styles.inputField} value={newPlan} onChange={e => setNewPlan(e.target.value)}>
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
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
            
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Business Name</label>
                <input required className={styles.inputField} type="text" value={editModal.name} onChange={e => setEditModal({...editModal, name: e.target.value})} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Subscription Plan</label>
                <select className={styles.inputField} value={editModal.subscriptionPlan} onChange={e => setEditModal({...editModal, subscriptionPlan: e.target.value})}>
                  <option value="FREE">Free</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>Status</label>
                <select className={styles.inputField} value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value})}>
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
