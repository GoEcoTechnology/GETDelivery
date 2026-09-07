'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../admin.module.css';
import { Search, Edit2, Trash2, Car, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';

export default function VehiclesClient() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [limit] = useState(7);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  
  // Modals
  const [editModal, setEditModal] = useState<any>(null);
  const [addModal, setAddModal] = useState(false);
  
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState('Motorcycle');
  const [newRegistrationExpiry, setNewRegistrationExpiry] = useState('');
  const [newOrNumber, setNewOrNumber] = useState('');
  const [newCrNumber, setNewCrNumber] = useState('');

  const getRegistrationStatus = (expiryDate: string) => {
    if (!expiryDate) return { text: 'No Reg Info', class: styles.badgeError };
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: 'Expired', class: styles.badgeError };
    if (diffDays <= 30) return { text: 'Expiring Soon', class: styles.badgeWarning };
    return { text: 'Valid', class: styles.badgeActive };
  };

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vehicles?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        setVehicles(json.data || []);
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
      fetchVehicles();
    }, 300);
    return () => clearTimeout(timer);
  }, [page, search, fetchVehicles]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      const res = await fetch(`/api/vehicles/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) fetchVehicles();
      else alert('Failed to delete vehicle');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    try {
      const payload = {
        plateNumber: editModal.plateNumber,
        vehicleType: editModal.vehicleType,
        orNumber: editModal.orNumber || null,
        crNumber: editModal.crNumber || null,
        registrationExpiry: editModal.registrationExpiry || null,
        status: editModal.status,
      };
      const res = await fetch(`/api/vehicles/${editModal.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setEditModal(null);
        fetchVehicles();
      } else {
        alert('Failed to update vehicle');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ 
          plateNumber: newPlate, 
          vehicleType: newType,
          registrationExpiry: newRegistrationExpiry ? new Date(newRegistrationExpiry) : null,
          orNumber: newOrNumber,
          crNumber: newCrNumber
        })
      });
      if (res.ok) {
        setAddModal(false);
        setNewPlate('');
        setNewType('Motorcycle');
        setNewRegistrationExpiry('');
        setNewOrNumber('');
        setNewCrNumber('');
        fetchVehicles();
      } else {
        alert('Failed to add vehicle');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div>

      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        
        {/* Toolbar */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by plate number..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={styles.inputField}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Total: {totalCount} vehicles
            </div>
            <button onClick={() => setAddModal(true)} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600 }}>
              <Car size={16} /> Register Vehicle
            </button>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Plate Number</th>
              <th>Vehicle Type</th>
              <th>Registration Info</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody className={!loading ? styles.fadeIn : ''}>
            {loading ? null : vehicles.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No vehicles found.
                </td>
              </tr>
            ) : (
              vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '15px' }}>{vehicle.plateNumber}</td>
                  <td style={{ color: '#475569' }}>
                    <span style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                      {vehicle.vehicleType}
                    </span>
                  </td>
                  <td>
                    {vehicle.orNumber || vehicle.crNumber || vehicle.registrationExpiry ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>OR: {vehicle.orNumber || '-'} | CR: {vehicle.crNumber || '-'}</span>
                        <span className={`${styles.badge} ${getRegistrationStatus(vehicle.registrationExpiry).class}`} style={{ width: 'fit-content', fontSize: '11px' }}>
                          Reg {getRegistrationStatus(vehicle.registrationExpiry).text}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>Not provided</span>
                    )}
                  </td>
                  <td>
                    {vehicle.status === 'ACTIVE' 
                      ? <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                      : <span className={`${styles.badge} ${styles.badgeError}`}>Inactive</span>
                    }
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ActionMenu actions={[
                      { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => setEditModal(vehicle), color: '#3b82f6' },
                      { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDelete(vehicle.id), color: '#ef4444' }
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Register Vehicle</h2>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className={styles.label}>Plate Number</label>
                  <input required className={styles.inputField} type="text" value={newPlate} onChange={e => setNewPlate(e.target.value)} placeholder="ABC-1234" />
                </div>
                <div>
                  <label className={styles.label}>Vehicle Type</label>
                  <select className={styles.inputField} value={newType} onChange={e => setNewType(e.target.value)}>
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Sedan">Sedan</option>
                    <option value="Van">Van</option>
                    <option value="Truck">Truck</option>
                  </select>
                </div>
              </div>
              
              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className={styles.label}>OR Number</label>
                  <input className={styles.inputField} type="text" value={newOrNumber} onChange={e => setNewOrNumber(e.target.value)} />
                </div>
                <div>
                  <label className={styles.label}>CR Number</label>
                  <input className={styles.inputField} type="text" value={newCrNumber} onChange={e => setNewCrNumber(e.target.value)} />
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>Registration Expiry Date</label>
                <input className={styles.inputField} type="date" value={newRegistrationExpiry} onChange={e => setNewRegistrationExpiry(e.target.value)} />
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Edit Vehicle</h2>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className={styles.label}>Plate Number</label>
                  <input required className={styles.inputField} type="text" value={editModal.plateNumber} onChange={e => setEditModal({...editModal, plateNumber: e.target.value})} />
                </div>
                <div>
                  <label className={styles.label}>Vehicle Type</label>
                  <select className={styles.inputField} value={editModal.vehicleType} onChange={e => setEditModal({...editModal, vehicleType: e.target.value})}>
                    <option value="Motorcycle">Motorcycle</option>
                    <option value="Sedan">Sedan</option>
                    <option value="Van">Van</option>
                    <option value="Truck">Truck</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className={styles.label}>OR Number</label>
                  <input className={styles.inputField} type="text" value={editModal.orNumber || ''} onChange={e => setEditModal({...editModal, orNumber: e.target.value})} />
                </div>
                <div>
                  <label className={styles.label}>CR Number</label>
                  <input className={styles.inputField} type="text" value={editModal.crNumber || ''} onChange={e => setEditModal({...editModal, crNumber: e.target.value})} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Registration Expiry</label>
                <input className={styles.inputField} type="date" value={editModal.registrationExpiry ? new Date(editModal.registrationExpiry).toISOString().split('T')[0] : ''} onChange={e => setEditModal({...editModal, registrationExpiry: e.target.value ? new Date(e.target.value).toISOString() : null})} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>Status</label>
                <select className={styles.inputField} value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value})}>
                  <option value="ACTIVE">Active / Available</option>
                  <option value="MAINTENANCE">Under Maintenance</option>
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
