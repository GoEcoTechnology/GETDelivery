'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Truck, Users } from 'lucide-react';
import styles from '../admin.module.css';

interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryId: number | null;
  onDispatchComplete: () => void;
}

export function DispatchModal({ isOpen, onClose, deliveryId, onDispatchComplete }: DispatchModalProps) {
  const [selectedOption, setSelectedOption] = useState<'internal' | 'partner' | null>(null);
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>('');

  const { data: driversData, isLoading: loadingDrivers } = useQuery({
    queryKey: ['company-drivers'],
    queryFn: async () => {
      const res = await fetch('/api/company/drivers', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch drivers');
      return res.json();
    },
    enabled: isOpen && selectedOption === 'internal'
  });

  const { data: vehiclesData, isLoading: loadingVehicles } = useQuery({
    queryKey: ['company-vehicles'],
    queryFn: async () => {
      const res = await fetch('/api/company/vehicles', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch vehicles');
      return res.json();
    },
    enabled: isOpen && selectedOption === 'internal'
  });

  const internalDispatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/deliveries/${deliveryId}/dispatch-internal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ driverId, vehicleId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch internally');
      return data;
    },
    onSuccess: () => {
      onClose();
      onDispatchComplete();
      alert('Delivery assigned successfully!');
    },
    onError: (error: any) => {
      alert(`Error: ${error.message}`);
    }
  });

  const partnerDispatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/deliveries/${deliveryId}/dispatch`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch to partners');
      return data;
    },
    onSuccess: () => {
      onClose();
      onDispatchComplete();
      alert('Delivery dispatched successfully! Push Notifications broadcasted.');
    },
    onError: (error: any) => {
      alert(`Error: ${error.message}`);
    }
  });

  if (!isOpen) return null;

  const handleDispatch = () => {
    if (selectedOption === 'internal') {
      if (!driverId || !vehicleId) {
        alert('Please select both a driver and a vehicle.');
        return;
      }
      internalDispatchMutation.mutate();
    } else if (selectedOption === 'partner') {
      partnerDispatchMutation.mutate();
    }
  };

  const isSubmitting = internalDispatchMutation.isPending || partnerDispatchMutation.isPending;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Dispatch Delivery #{deliveryId}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <p style={{ margin: '0 0 24px 0', color: '#475569', fontSize: '15px' }}>
            Choose how you want to dispatch this delivery.
          </p>

          <div className={styles.gridCols2} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {/* Option 1 */}
            <div 
              onClick={() => setSelectedOption('internal')}
              style={{
                padding: '20px', borderRadius: '12px', border: `2px solid ${selectedOption === 'internal' ? '#3b82f6' : '#e2e8f0'}`,
                backgroundColor: selectedOption === 'internal' ? '#eff6ff' : 'white',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: selectedOption === 'internal' ? '#1d4ed8' : '#475569' }}>
                <Truck size={24} />
                <span style={{ fontWeight: 700, fontSize: '16px' }}>Use Own Transport</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Assign an internal company driver and vehicle directly to this delivery.
              </p>
            </div>

            {/* Option 2 */}
            <div 
              onClick={() => setSelectedOption('partner')}
              style={{
                padding: '20px', borderRadius: '12px', border: `2px solid ${selectedOption === 'partner' ? '#3b82f6' : '#e2e8f0'}`,
                backgroundColor: selectedOption === 'partner' ? '#eff6ff' : 'white',
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: selectedOption === 'partner' ? '#1d4ed8' : '#475569' }}>
                <Users size={24} />
                <span style={{ fontWeight: 700, fontSize: '16px' }}>Rent Delivery Partner</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                  Broadcast a push notification to all available delivery partners. First to accept gets assigned.
              </p>
            </div>
          </div>

          {selectedOption === 'internal' && (
            <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>Assign Details</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Select Driver</label>
                  <select 
                    value={driverId} onChange={(e) => setDriverId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                  >
                    <option value="">-- Choose Driver --</option>
                    {driversData?.data?.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name} ({d.mobile})</option>
                    ))}
                  </select>
                  {loadingDrivers && <span style={{ fontSize: '12px', color: '#64748b' }}>Loading drivers...</span>}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Select Vehicle</label>
                  <select 
                    value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
                  >
                    <option value="">-- Choose Vehicle --</option>
                    {vehiclesData?.data?.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.plateNumber} - {v.vehicleType}</option>
                    ))}
                  </select>
                  {loadingVehicles && <span style={{ fontSize: '12px', color: '#64748b' }}>Loading vehicles...</span>}
                </div>
              </div>
            </div>
          )}

          {selectedOption === 'partner' && (
            <div style={{ padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#166534', fontWeight: 500 }}>
                This will instantly send a Push Notification to all delivery partners with "AVAILABLE" status. You will be notified once a partner accepts.
              </p>
            </div>
          )}
        </div>

        <div style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onClose}
            disabled={isSubmitting}
            style={{ padding: '10px 20px', backgroundColor: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleDispatch}
            disabled={!selectedOption || isSubmitting}
            style={{ 
              padding: '10px 24px', backgroundColor: '#3b82f6', border: 'none', borderRadius: '8px', 
              cursor: (!selectedOption || isSubmitting) ? 'not-allowed' : 'pointer', 
              fontWeight: 600, color: 'white', opacity: (!selectedOption || isSubmitting) ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Dispatching...' : 'Confirm Dispatch'}
          </button>
        </div>
      </div>
    </div>
  );
}
