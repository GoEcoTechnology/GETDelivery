'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../admin.module.css';
import { Users, Search, Edit2, Trash2, Plus, X, Phone, Mail, MapPin, Eye } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';

export default function CustomersClient() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(7);
  const [search, setSearch] = useState('');

  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState<any>(null);
  const [viewModal, setViewModal] = useState<any>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    mobileNumber: '',
    email: '',
    address: '',
    municipality: '',
    barangay: '',
    notes: '',
    status: 'ACTIVE'
  });

  const resetForm = () => setFormData({
    name: '', contactPerson: '', mobileNumber: '', email: '',
    address: '', municipality: '', barangay: '', notes: '', status: 'ACTIVE'
  });

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, limit, search],
    queryFn: async () => {
      const res = await fetch(`/api/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch customers');
      return res.json();
    },
    initialData: undefined
  });

  const customers = data?.data || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const addMutation = useMutation({
    mutationFn: async (newCustomer: any) => {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(newCustomer)
      });
      if (!res.ok) throw new Error('Failed to add customer');
      return res.json();
    },
    onSuccess: () => {
      setAddModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (updatedCustomer: any) => {
      const res = await fetch(`/api/customers/${updatedCustomer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(updatedCustomer)
      });
      if (!res.ok) throw new Error('Failed to update customer');
      return res.json();
    },
    onSuccess: () => {
      setEditModal(null);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to delete customer');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editModal) {
      updateMutation.mutate({ ...formData, id: editModal.id });
    } else {
      addMutation.mutate(formData);
    }
  };

  const openEdit = (customer: any) => {
    setFormData({ ...customer });
    setEditModal(customer);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div>
      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226,232,240,0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search by name or mobile..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={styles.inputField}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
              Total: {totalCount}
            </div>
            <button
              onClick={() => { resetForm(); setAddModal(true); }}
              className={`${styles.btnPrimary} ${styles.toolbarBtn}`}
            >
              <Plus size={16} style={{ marginRight: '6px' }} /> New Customer
            </button>
          </div>
        </div>

        <table className={styles.table} style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: 'rgba(248, 250, 252, 0.9)' }}>
              <th style={{ width: '22%', textAlign: 'center', padding: '14px 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Customer</th>
              <th style={{ width: '26%', textAlign: 'center', padding: '14px 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Contact Info</th>
              <th style={{ width: '28%', textAlign: 'center', padding: '14px 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Location</th>
              <th style={{ width: '12%', textAlign: 'center', padding: '14px 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Status</th>
              <th style={{ width: '12%', textAlign: 'center', padding: '14px 10px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: '#64748b', textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody className={!isLoading ? styles.fadeIn : ''}>
            {isLoading ? null : customers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <Users size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                  <p>No customers found. Add your first customer.</p>
                </td>
              </tr>
            ) : (
              customers.map((c: any) => (
                <tr key={c.id} style={{ height: '84px' }}>
                  <td style={{ textAlign: 'center', padding: '12px 8px', verticalAlign: 'middle' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>{c.name}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Phone size={12} /> {c.mobileNumber}</span>
                      {c.email && <span style={{ fontSize: '13px', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}><Mail size={12} /> {c.email}</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', verticalAlign: 'middle' }}>
                    <div style={{ fontSize: '13px', color: '#475569', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', textAlign: 'center', maxWidth: '100%' }}>
                      <MapPin size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                      <span style={{ lineHeight: 1.45 }}>{c.address}{c.barangay ? `, ${c.barangay}` : ''}{c.municipality ? `, ${c.municipality}` : ''}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', verticalAlign: 'middle' }}>
                    <span className={`${styles.badge} ${c.status === 'ACTIVE' ? styles.badgeActive : styles.badgeError}`} style={{ margin: '0 auto' }}>
                      {c.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', padding: '12px 8px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <ActionMenu actions={[
                        { label: 'View Details', icon: <Eye size={14} />, onClick: () => setViewModal(c), color: '#0f172a' },
                        { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => openEdit(c), color: '#3b82f6' },
                        { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDelete(c.id), color: '#ef4444' }
                      ]} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', backgroundColor: '#f8fafc' }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className={styles.btnSecondary}>Previous</button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className={styles.btnSecondary}>Next</button>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {(addModal || editModal) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>{editModal ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => { setAddModal(false); setEditModal(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className={styles.label}>Business / Full Name*</label>
                <input required type="text" className={styles.inputField} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className={styles.label}>Contact Person</label>
                  <input type="text" className={styles.inputField} value={formData.contactPerson} onChange={e => setFormData({ ...formData, contactPerson: e.target.value })} />
                </div>
                <div>
                  <label className={styles.label}>Mobile Number*</label>
                  <input required type="text" className={styles.inputField} value={formData.mobileNumber} onChange={e => setFormData({ ...formData, mobileNumber: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={styles.label}>Email Address</label>
                <input type="email" className={styles.inputField} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className={styles.label}>Complete Address*</label>
                <input required type="text" className={styles.inputField} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label className={styles.label}>Municipality</label>
                  <input type="text" className={styles.inputField} value={formData.municipality} onChange={e => setFormData({ ...formData, municipality: e.target.value })} />
                </div>
                <div>
                  <label className={styles.label}>Barangay</label>
                  <input type="text" className={styles.inputField} value={formData.barangay} onChange={e => setFormData({ ...formData, barangay: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" className={styles.btnSecondary} onClick={() => { setAddModal(false); setEditModal(null); }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>{editModal ? 'Save Changes' : 'Create Customer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Customer Details</h2>
              <button onClick={() => setViewModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Business / Full Name</h3>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>{viewModal.name}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Contact Person</h3>
                  <p style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{viewModal.contactPerson || 'N/A'}</p>
                </div>
                <div>
                  <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Mobile Number</h3>
                  <p style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{viewModal.mobileNumber}</p>
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Email Address</h3>
                <p style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{viewModal.email || 'N/A'}</p>
              </div>
              <div>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Complete Address</h3>
                <p style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{viewModal.address}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Municipality</h3>
                  <p style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{viewModal.municipality || 'N/A'}</p>
                </div>
                <div>
                  <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Barangay</h3>
                  <p style={{ margin: 0, fontSize: '15px', color: '#1e293b' }}>{viewModal.barangay || 'N/A'}</p>
                </div>
              </div>
              <div>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', margin: '0 0 4px 0' }}>Status</h3>
                <span className={`${styles.badge} ${viewModal.status === 'ACTIVE' ? styles.badgeActive : styles.badgeError}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                  {viewModal.status}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setViewModal(null)} className={styles.btnPrimary}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
