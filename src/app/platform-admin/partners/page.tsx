'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../../admin/admin.module.css';
import { Search, Edit2, Trash2, Briefcase, ChevronLeft, ChevronRight, X, CheckCircle, XCircle } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';

export default function PartnersPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(7);
  const [search, setSearch] = useState('');

  const [editModal, setEditModal] = useState<any>(null);
  const [addModal, setAddModal] = useState(false);

  const [newCompany, setNewCompany] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [addError, setAddError] = useState('');

  const getToken = () => localStorage.getItem('token') || '';

  const { data, isPending } = useQuery({
    queryKey: ['partners', page, limit, search],
    queryFn: async () => {
      const res = await fetch(`/api/partners?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&excludeStatus=PENDING`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Failed to fetch partners');
      return res.json();
    },
    staleTime: 60 * 1000
  });

  const partners = data?.data || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/partners/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partners'] })
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/partners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['partners'] })
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/partners/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ companyName: data.companyName, contactPerson: data.contactPerson, mobileNumber: data.mobileNumber, email: data.email, status: data.status })
      });
      if (!res.ok) throw new Error('Failed to update partner');
    },
    onSuccess: () => { setEditModal(null); queryClient.invalidateQueries({ queryKey: ['partners'] }); }
  });

  const addMutation = useMutation({
    mutationFn: async (partnerData: any) => {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify(partnerData)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to add partner');
    },
    onSuccess: () => {
      setAddModal(false);
      setNewCompany(''); setNewContact(''); setNewMobile(''); setNewEmail(''); setNewPassword(''); setAddError('');
      queryClient.invalidateQueries({ queryKey: ['partners'] });
    },
    onError: (err: any) => setAddError(err.message)
  });

  const statusColor = (status: string) => {
    if (status === 'ACTIVE') return { bg: '#dcfce7', color: '#15803d' };
    if (status === 'INACTIVE') return { bg: '#f1f5f9', color: '#64748b' };
    if (status === 'REJECTED') return { bg: '#fef2f2', color: '#dc2626' };
    if (status === 'PENDING') return { bg: '#fef9c3', color: '#a16207' };
    return { bg: '#f1f5f9', color: '#475569' };
  };

  return (
    <div>
      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '200px' }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by company name..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className={styles.inputField}
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>
          <button onClick={() => setAddModal(true)} className={styles.btnPrimary} style={{ whiteSpace: 'nowrap' }}>
            <Briefcase size={16} /> Register Partner
          </button>
        </div>

        <div className="table-responsive-wrapper">

          <table className={styles.table}>
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Contact Person</th>
              <th>Mobile Number</th>
              <th>Email</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} style={{ padding: '20px 24px' }}>
                      <div style={{ height: '16px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', borderRadius: '6px', animation: 'shimmer 1.5s infinite', width: j === 0 ? '80%' : j === 5 ? '40px' : '70%', marginLeft: j === 5 ? 'auto' : 0 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No partners found.</td>
              </tr>
            ) : (
              partners.map((partner: any) => {
                const sc = statusColor(partner.status);
                return (
                  <tr key={partner.id}>
                    <td style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>{partner.companyName}</td>
                    <td style={{ fontWeight: 500, color: '#475569' }}>{partner.contactPerson}</td>
                    <td style={{ color: '#475569' }}>{partner.mobileNumber}</td>
                    <td style={{ color: '#475569', fontSize: '13px' }}>{partner.email || '-'}</td>
                    <td>
                      <span style={{ padding: '4px 10px', backgroundColor: sc.bg, color: sc.color, borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                        {partner.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <ActionMenu actions={[
                        ...(partner.status === 'PENDING' ? [
                          {
                            label: 'Approve',
                            icon: <CheckCircle size={14} />,
                            onClick: () => updateStatusMutation.mutate({ id: partner.id, status: 'ACTIVE' }),
                            color: '#16a34a'
                          },
                          {
                            label: 'Reject',
                            icon: <XCircle size={14} />,
                            onClick: () => updateStatusMutation.mutate({ id: partner.id, status: 'REJECTED' }),
                            color: '#dc2626'
                          }
                        ] : []),
                        {
                          label: 'Edit',
                          icon: <Edit2 size={14} />,
                          onClick: () => setEditModal(partner),
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 size={14} />,
                          onClick: () => {
                            if (confirm('Delete this delivery partner?')) deleteMutation.mutate(partner.id);
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
        <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page === 1 ? 0.5 : 1 }}>
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page >= totalPages ? 0.5 : 1 }}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Add Modal */}
      {addModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Register Partner</h2>
              <button onClick={() => { setAddModal(false); setAddError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            {addError && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{addError}</div>}
            <form onSubmit={(e) => { e.preventDefault(); setAddError(''); addMutation.mutate({ companyName: newCompany, contactPerson: newContact, mobileNumber: newMobile, email: newEmail, password: newPassword, status: 'ACTIVE' }); }}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Logistics Company Name</label>
                <input required className={styles.inputField} type="text" value={newCompany} onChange={e => setNewCompany(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className={styles.label}>Contact Person</label>
                  <input required className={styles.inputField} type="text" value={newContact} onChange={e => setNewContact(e.target.value)} />
                </div>
                <div>
                  <label className={styles.label}>Mobile Number</label>
                  <input required className={styles.inputField} type="tel" value={newMobile} onChange={e => setNewMobile(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className={styles.label}>Email Address</label>
                  <input required className={styles.inputField} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                </div>
                <div>
                  <label className={styles.label}>Password</label>
                  <input required minLength={6} className={styles.inputField} type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setAddModal(false); setAddError(''); }} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} disabled={addMutation.isPending}>
                  {addMutation.isPending ? 'Registering...' : 'Register Partner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Edit Partner</h2>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(editModal); }}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Logistics Company Name</label>
                <input required className={styles.inputField} type="text" value={editModal.companyName} onChange={e => setEditModal({ ...editModal, companyName: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className={styles.label}>Contact Person</label>
                  <input required className={styles.inputField} type="text" value={editModal.contactPerson} onChange={e => setEditModal({ ...editModal, contactPerson: e.target.value })} />
                </div>
                <div>
                  <label className={styles.label}>Mobile Number</label>
                  <input required className={styles.inputField} type="tel" value={editModal.mobileNumber} onChange={e => setEditModal({ ...editModal, mobileNumber: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className={styles.label}>Email Address</label>
                  <input className={styles.inputField} type="email" value={editModal.email || ''} onChange={e => setEditModal({ ...editModal, email: e.target.value })} />
                </div>
                <div>
                  <label className={styles.label}>Status</label>
                  <select className={styles.inputField} value={editModal.status} onChange={e => setEditModal({ ...editModal, status: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
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
