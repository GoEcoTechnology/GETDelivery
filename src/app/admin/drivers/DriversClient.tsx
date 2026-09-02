'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../admin.module.css';
import { Search, UserPlus, X, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';

export default function DriversClient() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [limit] = useState(7);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  
  // Modals
  const [editModal, setEditModal] = useState<any>(null);
  const [addModal, setAddModal] = useState(false);
  
  // New Driver State
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newLicenseNumber, setNewLicenseNumber] = useState('');
  const [newLicenseType, setNewLicenseType] = useState('');
  const [newLicenseExpiry, setNewLicenseExpiry] = useState('');

  const getLicenseStatus = (expiryDate: string) => {
    if (!expiryDate) return { text: 'No License', class: styles.badgeError };
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Expired', class: styles.badgeError };
    if (diffDays <= 30) return { text: 'Expiring Soon', class: styles.badgeWarning };
    return { text: 'Valid', class: styles.badgeActive };
  };

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drivers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        setDrivers(json.data || []);
        setTotalCount(json.totalCount || 0);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    
    const timer = setTimeout(() => {
      fetchDrivers();
    }, 300);
    return () => clearTimeout(timer);
  }, [page, search, fetchDrivers]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;
    try {
      const res = await fetch(`/api/drivers/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) fetchDrivers();
      else alert('Failed to delete driver');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    try {
      const payload = {
        name: editModal.name,
        mobile: editModal.mobile,
        licenseNumber: editModal.licenseNumber || null,
        licenseType: editModal.licenseType || null,
        licenseExpiry: editModal.licenseExpiry || null,
        status: editModal.status,
      };
      const res = await fetch(`/api/drivers/${editModal.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditModal(null);
        fetchDrivers();
      } else {
        alert('Failed to update driver');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/drivers', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ 
          name: newName, 
          mobile: newMobile,
          licenseNumber: newLicenseNumber,
          licenseType: newLicenseType,
          licenseExpiry: newLicenseExpiry ? new Date(newLicenseExpiry) : null
        })
      });
      if (res.ok) {
        setAddModal(false);
        setNewName('');
        setNewMobile('');
        setNewLicenseNumber('');
        setNewLicenseType('');
        setNewLicenseExpiry('');
        fetchDrivers();
      } else {
        alert('Failed to add driver');
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
          <h1>Fleet Drivers</h1>
          <p>Manage your delivery personnel</p>
        </div>
      </div>

      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        
        {/* Toolbar */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by driver name..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={styles.inputField}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Total: {totalCount} drivers
            </div>
            <button onClick={() => setAddModal(true)} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}>
              <UserPlus size={16} /> Register Driver
            </button>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Driver Name</th>
              <th>Mobile Number</th>
              <th>License Info</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody className={!loading ? styles.fadeIn : ''}>
            {loading ? null : drivers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No drivers found.
                </td>
              </tr>
            ) : (
              drivers.map((driver) => (
                <tr key={driver.id}>
                  <td style={{ fontWeight: 600 }}>{driver.name}</td>
                  <td style={{ color: '#64748b' }}>{driver.mobile}</td>
                  <td>
                    {driver.licenseNumber ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{driver.licenseNumber} ({driver.licenseType})</span>
                        <span className={`${styles.badge} ${getLicenseStatus(driver.licenseExpiry).class}`} style={{ width: 'fit-content', fontSize: '11px' }}>
                          License {getLicenseStatus(driver.licenseExpiry).text}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Not provided</span>
                    )}
                  </td>
                  <td>
                    {driver.status === 'ACTIVE' 
                      ? <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                      : <span className={`${styles.badge} ${styles.badgeError}`}>Inactive</span>
                    }
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ActionMenu actions={[
                      { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => setEditModal(driver), color: '#3b82f6' },
                      { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDelete(driver.id), color: '#ef4444' }
                    ]} />
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
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page === 1 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Page {page} of {totalPages || 1}</span>
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Register Driver</h2>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Driver Full Name</label>
                <input required className={styles.inputField} type="text" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Mobile Number</label>
                <input required className={styles.inputField} type="tel" value={newMobile} onChange={e => setNewMobile(e.target.value)} placeholder="+639..." />
              </div>
              
              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className={styles.label}>License Number</label>
                  <input className={styles.inputField} type="text" value={newLicenseNumber} onChange={e => setNewLicenseNumber(e.target.value)} />
                </div>
                <div>
                  <label className={styles.label}>License Type</label>
                  <select className={styles.inputField} value={newLicenseType} onChange={e => setNewLicenseType(e.target.value)}>
                    <option value="">Select Type</option>
                    <option value="Non-Professional">Non-Professional</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>License Expiry Date</label>
                <input className={styles.inputField} type="date" value={newLicenseExpiry} onChange={e => setNewLicenseExpiry(e.target.value)} />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAddModal(false)} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Register</button>
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Edit Driver</h2>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Driver Name</label>
                <input required className={styles.inputField} type="text" value={editModal.name} onChange={e => setEditModal({...editModal, name: e.target.value})} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Mobile Number</label>
                <input required className={styles.inputField} type="tel" value={editModal.mobile} onChange={e => setEditModal({...editModal, mobile: e.target.value})} />
              </div>
              
              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className={styles.label}>License Number</label>
                  <input className={styles.inputField} type="text" value={editModal.licenseNumber || ''} onChange={e => setEditModal({...editModal, licenseNumber: e.target.value})} />
                </div>
                <div>
                  <label className={styles.label}>License Type</label>
                  <select className={styles.inputField} value={editModal.licenseType || ''} onChange={e => setEditModal({...editModal, licenseType: e.target.value})}>
                    <option value="">Select Type</option>
                    <option value="Non-Professional">Non-Professional</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>License Expiry</label>
                <input className={styles.inputField} type="date" value={editModal.licenseExpiry ? new Date(editModal.licenseExpiry).toISOString().split('T')[0] : ''} onChange={e => setEditModal({...editModal, licenseExpiry: e.target.value ? new Date(e.target.value).toISOString() : null})} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>Status</label>
                <select className={styles.inputField} value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value})}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
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
