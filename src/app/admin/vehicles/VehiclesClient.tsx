'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../admin.module.css';
import { Search, Edit2, Trash2, Car, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';
import { EmptyState } from '@/components/EmptyState';

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
  const [newType, setNewType] = useState('');
  const [newRegistrationExpiry, setNewRegistrationExpiry] = useState('');
  const [newOrNumber, setNewOrNumber] = useState('');
  const [newCrNumber, setNewCrNumber] = useState('');
  const [newCapacityKg, setNewCapacityKg] = useState('');
  const [newCargoLengthCm, setNewCargoLengthCm] = useState('');
  const [newCargoWidthCm, setNewCargoWidthCm] = useState('');
  const [newCargoHeightCm, setNewCargoHeightCm] = useState('');

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
      if (res.ok) {
        fetchVehicles();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || data?.message || 'Failed to delete vehicle');
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to delete vehicle');
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
        capacityKg: Number(editModal.capacityKg) || 0,
        cargoLengthCm: Number(editModal.cargoLengthCm) || 100,
        cargoWidthCm: Number(editModal.cargoWidthCm) || 80,
        cargoHeightCm: Number(editModal.cargoHeightCm) || 80,
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
          capacityKg: Number(newCapacityKg) || 0,
          cargoLengthCm: Number(newCargoLengthCm) || 100,
          cargoWidthCm: Number(newCargoWidthCm) || 80,
          cargoHeightCm: Number(newCargoHeightCm) || 80,
          registrationExpiry: newRegistrationExpiry ? new Date(newRegistrationExpiry) : null,
          orNumber: newOrNumber,
          crNumber: newCrNumber
        })
      });
      if (res.ok) {
        setAddModal(false);
        setNewPlate('');
        setNewType('');
        setNewRegistrationExpiry('');
        setNewOrNumber('');
        setNewCrNumber('');
        setNewCapacityKg('');
        setNewCargoLengthCm('');
        setNewCargoWidthCm('');
        setNewCargoHeightCm('');
        fetchVehicles();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to add vehicle');
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
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '200px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              Total: {totalCount} vehicles
            </div>
            <button onClick={() => setAddModal(true)} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              <Car size={16} /> Register Vehicle
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className={styles.table} style={{ minWidth: '700px' }}>
          <thead>
            <tr>
              <th>Plate Number</th>
              <th>Vehicle Type</th>
              <th>Payload (kg)</th>
              <th>Cargo Space (L×W×H)</th>
              <th>Registration Info</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody className={!loading ? styles.fadeIn : ''}>
            {loading ? null : vehicles.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '0', border: 'none' }}>
                  <EmptyState
                    icon={Car}
                    title="No Vehicles Found"
                    description="No vehicles found. Register your first vehicle."
                    actionButton={<button onClick={() => setAddModal(true)} className={styles.btnPrimary}>+ Register Vehicle</button>}
                  />
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
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>
                    {vehicle.capacityKg} kg
                  </td>
                  <td style={{ color: '#475569', fontSize: '13px' }}>
                    <span style={{ fontFamily: 'monospace', background: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      {vehicle.cargoLengthCm || 100} × {vehicle.cargoWidthCm || 80} × {vehicle.cargoHeightCm || 80} cm
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
                      : vehicle.status === 'NOT AVAILABLE'
                      ? <span className={`${styles.badge} ${styles.badgeWarning}`}>On Delivery</span>
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
        </div>

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
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Register Vehicle</h2>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAdd}>
              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className={styles.label}>Plate Number *</label>
                  <input required className={styles.inputField} type="text" value={newPlate} onChange={e => setNewPlate(e.target.value)} placeholder="ABC-1234" />
                </div>
                <div>
                  <label className={styles.label}>Vehicle Type *</label>
                  <input required className={styles.inputField} type="text" value={newType} onChange={e => setNewType(e.target.value)} placeholder="e.g. Motorcycle, Van, Truck" />
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Max Payload Capacity (kg) *</label>
                <input required className={styles.inputField} type="number" min="1" step="0.1" value={newCapacityKg} onChange={e => setNewCapacityKg(e.target.value)} placeholder="e.g. 500" />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Maximum total product weight this vehicle can carry</span>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                  Cargo Bed / Compartment Dimensions (cm)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className={styles.label} style={{ fontSize: '11px' }}>Length (cm)</label>
                    <input className={styles.inputField} type="number" min="10" step="1" value={newCargoLengthCm} onChange={e => setNewCargoLengthCm(e.target.value)} placeholder="180" />
                  </div>
                  <div>
                    <label className={styles.label} style={{ fontSize: '11px' }}>Width (cm)</label>
                    <input className={styles.inputField} type="number" min="10" step="1" value={newCargoWidthCm} onChange={e => setNewCargoWidthCm(e.target.value)} placeholder="120" />
                  </div>
                  <div>
                    <label className={styles.label} style={{ fontSize: '11px' }}>Height (cm)</label>
                    <input className={styles.inputField} type="number" min="10" step="1" value={newCargoHeightCm} onChange={e => setNewCargoHeightCm(e.target.value)} placeholder="110" />
                  </div>
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

              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Registration Expiry Date</label>
                <input className={styles.inputField} type="date" value={newRegistrationExpiry} onChange={e => setNewRegistrationExpiry(e.target.value)} />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" onClick={() => setAddModal(false)} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Register Vehicle</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Edit Vehicle</h2>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className={styles.label}>Plate Number *</label>
                  <input required className={styles.inputField} type="text" value={editModal.plateNumber} onChange={e => setEditModal({...editModal, plateNumber: e.target.value})} />
                </div>
                <div>
                  <label className={styles.label}>Vehicle Type *</label>
                  <input required className={styles.inputField} type="text" value={editModal.vehicleType} onChange={e => setEditModal({...editModal, vehicleType: e.target.value})} placeholder="e.g. Motorcycle, Van, Truck" />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Max Payload Capacity (kg) *</label>
                <input required className={styles.inputField} type="number" min="1" step="0.1" value={editModal.capacityKg || ''} onChange={e => setEditModal({...editModal, capacityKg: e.target.value})} />
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                  Cargo Bed / Compartment Dimensions (cm)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className={styles.label} style={{ fontSize: '11px' }}>Length (cm)</label>
                    <input className={styles.inputField} type="number" min="10" step="1" value={editModal.cargoLengthCm ?? ''} onChange={e => setEditModal({...editModal, cargoLengthCm: e.target.value})} placeholder="100" />
                  </div>
                  <div>
                    <label className={styles.label} style={{ fontSize: '11px' }}>Width (cm)</label>
                    <input className={styles.inputField} type="number" min="10" step="1" value={editModal.cargoWidthCm ?? ''} onChange={e => setEditModal({...editModal, cargoWidthCm: e.target.value})} placeholder="80" />
                  </div>
                  <div>
                    <label className={styles.label} style={{ fontSize: '11px' }}>Height (cm)</label>
                    <input className={styles.inputField} type="number" min="10" step="1" value={editModal.cargoHeightCm ?? ''} onChange={e => setEditModal({...editModal, cargoHeightCm: e.target.value})} placeholder="80" />
                  </div>
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
                  <option value="NOT AVAILABLE">On Delivery</option>
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
