'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../../admin/admin.module.css';
import { Search, Edit2, Trash2, Briefcase, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function PartnersPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  
  // Modals
  const [editModal, setEditModal] = useState<any>(null);
  const [addModal, setAddModal] = useState(false);
  
  // New Partner State
  const [newCompany, setNewCompany] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/partners?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch partners');
      
      const { data, totalCount } = await res.json();
      
      const formattedData = (data || []).map((p: any) => ({
        id: p.id,
        companyName: p.companyName,
        contactPerson: p.contactPerson,
        mobileNumber: p.mobileNumber,
        email: p.email,
        status: p.status
      }));
      
      setPartners(formattedData);
      setTotalCount(totalCount || 0);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this delivery partner?')) return;
    try {
      const res = await fetch(`/api/partners/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) fetchPartners();
      else alert('Failed to delete partner');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    try {
      const res = await fetch(`/api/partners/${editModal.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}` 
        },
        body: JSON.stringify({
          companyName: editModal.companyName,
          contactPerson: editModal.contactPerson,
          mobileNumber: editModal.mobileNumber,
          email: editModal.email,
          status: editModal.status
        })
      });
      
      if (res.ok) {
        setEditModal(null);
        fetchPartners();
      } else {
        alert('Failed to update partner');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}` 
        },
        body: JSON.stringify({
          companyName: newCompany,
          contactPerson: newContact,
          mobileNumber: newMobile,
          email: newEmail,
          status: 'ACTIVE'
        })
      });
      
      if (res.ok) {
        setAddModal(false);
        setNewCompany('');
        setNewContact('');
        setNewMobile('');
        setNewEmail('');
        fetchPartners();
      } else {
        alert('Failed to add partner');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Delivery Partners</h1>
          <p>Manage third-party logistics partners</p>
        </div>
        <button onClick={() => setAddModal(true)} className={styles.btnPrimary}>
          <Briefcase size={16} /> Register Partner
        </button>
      </div>

      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        
        {/* Toolbar */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
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
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            Total: {totalCount} partners
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Contact Person</th>
              <th>Mobile Number</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {partners.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No partners found.
                </td>
              </tr>
            ) : (
              partners.map((partner) => (
                <tr key={partner.id}>
                  <td style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>{partner.companyName}</td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#475569' }}>{partner.contactPerson}</span>
                    {partner.email && <div style={{ fontSize: '12px', color: '#94a3b8' }}>{partner.email}</div>}
                  </td>
                  <td style={{ color: '#475569', fontWeight: 500 }}>{partner.mobileNumber}</td>
                  <td>
                    {partner.status === 'ACTIVE' 
                      ? <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                      : <span className={`${styles.badge} ${styles.badgeError}`}>Inactive</span>
                    }
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => setEditModal(partner)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '8px' }}>
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(partner.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px' }}>
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
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Register Partner</h2>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAdd}>
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
              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>Email Address (Optional)</label>
                <input className={styles.inputField} type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAddModal(false)} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Register Partner</button>
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
            
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Logistics Company Name</label>
                <input required className={styles.inputField} type="text" value={editModal.companyName} onChange={e => setEditModal({...editModal, companyName: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className={styles.label}>Contact Person</label>
                  <input required className={styles.inputField} type="text" value={editModal.contactPerson} onChange={e => setEditModal({...editModal, contactPerson: e.target.value})} />
                </div>
                <div>
                  <label className={styles.label}>Mobile Number</label>
                  <input required className={styles.inputField} type="tel" value={editModal.mobileNumber} onChange={e => setEditModal({...editModal, mobileNumber: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className={styles.label}>Email Address</label>
                  <input className={styles.inputField} type="email" value={editModal.email || ''} onChange={e => setEditModal({...editModal, email: e.target.value})} />
                </div>
                <div>
                  <label className={styles.label}>Status</label>
                  <select className={styles.inputField} value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value})}>
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
