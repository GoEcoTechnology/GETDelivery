'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Truck, Users, AlertTriangle } from 'lucide-react';
import styles from '../admin.module.css';

interface DispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  deliveryId: number | null;
  tenantId?: number | null;
  type?: 'delivery' | 'batch';
  onDispatchComplete: () => void;
}

export function DispatchModal({ isOpen, onClose, deliveryId, tenantId, type = 'delivery', onDispatchComplete }: DispatchModalProps) {
  const [selectedOption, setSelectedOption] = useState<'internal' | 'partner' | null>('internal');
  const [driverId, setDriverId] = useState<string>('');
  const [vehicleId, setVehicleId] = useState<string>('');
  const [customFee, setCustomFee] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setSelectedOption('internal');
      setDriverId('');
      setVehicleId('');
    }
  }, [isOpen]);

  const { data: driversData, isLoading: loadingDrivers } = useQuery({
    queryKey: ['company-drivers', tenantId, deliveryId, type],
    queryFn: async () => {
      const headers: HeadersInit = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` };
      if (tenantId) headers['x-tenant-id'] = tenantId.toString();
      const params = new URLSearchParams();
      if (tenantId) params.append('tenantId', tenantId.toString());
      if (deliveryId) {
        if (type === 'batch') params.append('batchId', deliveryId.toString());
        else params.append('deliveryId', deliveryId.toString());
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/company/drivers${qs}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch drivers');
      return res.json();
    },
    enabled: isOpen && !!deliveryId,
    staleTime: 60 * 1000,
  });

  const { data: vehiclesData, isLoading: loadingVehicles } = useQuery({
    queryKey: ['company-vehicles', tenantId, deliveryId, type],
    queryFn: async () => {
      const headers: HeadersInit = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` };
      if (tenantId) headers['x-tenant-id'] = tenantId.toString();
      const params = new URLSearchParams();
      if (tenantId) params.append('tenantId', tenantId.toString());
      if (deliveryId) {
        if (type === 'batch') params.append('batchId', deliveryId.toString());
        else params.append('deliveryId', deliveryId.toString());
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/company/vehicles${qs}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch vehicles');
      return res.json();
    },
    enabled: isOpen && !!deliveryId,
    staleTime: 60 * 1000,
  });

  // Automatically select the vehicle determined by the system based on all batch products (if not busy)
  useEffect(() => {
    if (vehiclesData?.data?.length > 0 && !vehicleId) {
      const sv = vehiclesData.suggestedVehicleId
        ? vehiclesData.data.find((v: any) => v.id === vehiclesData.suggestedVehicleId)
        : null;
      if (sv && !sv.isBusy) {
        setVehicleId(sv.id.toString());
      } else {
        const available = vehiclesData.data.find((v: any) => !v.isBusy);
        if (available) setVehicleId(available.id.toString());
      }
    }
  }, [vehiclesData?.suggestedVehicleId, vehiclesData?.data, vehicleId]);

  // Pre-select driver if available and not busy
  useEffect(() => {
    if (driversData?.data?.length > 0 && !driverId) {
      const available = driversData.data.find((d: any) => !d.isBusy);
      if (available) {
        setDriverId(available.id.toString());
      }
    }
  }, [driversData?.data, driverId]);

  const internalDispatchMutation = useMutation({
    mutationFn: async () => {
      const endpoint = type === 'batch'
        ? `/api/deliveries/batches/${deliveryId}/dispatch-internal`
        : `/api/deliveries/${deliveryId}/dispatch-internal`;

      const headers: HeadersInit = {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      };
      if (tenantId) headers['x-tenant-id'] = tenantId.toString();

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ driverId, vehicleId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch internally');
      return data;
    },
    onSuccess: () => {
      onClose();
      onDispatchComplete();
    },
    onError: (error: any) => {
      alert(`Error: ${error.message}`);
    }
  });

  const partnerDispatchMutation = useMutation({
    mutationFn: async () => {
      const endpoint = type === 'batch'
        ? `/api/deliveries/batches/${deliveryId}/dispatch`
        : `/api/deliveries/${deliveryId}/dispatch`;

      const headers: HeadersInit = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` };
      if (tenantId) headers['x-tenant-id'] = tenantId.toString();

      const res = await fetch(endpoint, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch to partners');
      return data;
    },
    onSuccess: () => {
      onClose();
      onDispatchComplete();
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
      const selDriver = driversData?.data?.find((d: any) => d.id.toString() === driverId);
      if (selDriver?.isBusy) {
        alert(`Driver "${selDriver.name}" is currently in use on an active delivery and cannot be assigned.`);
        return;
      }
      const selVehicle = vehiclesData?.data?.find((v: any) => v.id.toString() === vehicleId);
      if (selVehicle?.isBusy) {
        alert(`Vehicle "${selVehicle.plateNumber || selVehicle.vehicleType}" is currently in use on an active delivery and cannot be assigned.`);
        return;
      }
      internalDispatchMutation.mutate();
    } else if (selectedOption === 'partner') {
      partnerDispatchMutation.mutate();
    }
  };

  const selectedVehicleEval = vehicleId
    ? vehiclesData?.evaluations?.find((e: any) => e.id.toString() === vehicleId)
    : null;

  const isSubmitting = internalDispatchMutation.isPending || partnerDispatchMutation.isPending;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Dispatch {type === 'batch' ? 'Batch' : 'Delivery'}</h2>
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
                    disabled={loadingDrivers}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', backgroundColor: loadingDrivers ? '#f1f5f9' : 'white' }}
                  >
                    <option value="">{loadingDrivers ? 'Loading drivers...' : '-- Choose Driver --'}</option>
                    {driversData?.data?.map((d: any) => (
                      <option key={d.id} value={d.id} disabled={d.isBusy} style={{ color: d.isBusy ? '#94a3b8' : 'inherit' }}>
                        {d.name} ({d.mobile}) {d.isBusy ? '— (In Use / Delivering)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                    <label style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>Select Vehicle</label>
                    {selectedVehicleEval && selectedVehicleEval.fits === false ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} /> Does Not Fit Selected Vehicle
                      </span>
                    ) : vehiclesData?.suggestedVehicle ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '999px' }}>
                        System Assigned: {vehiclesData.suggestedVehicle.vehicleType}
                      </span>
                    ) : loadingVehicles ? (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Calculating suitability...</span>
                    ) : null}
                  </div>
                  <select
                    value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
                    disabled={loadingVehicles}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: selectedVehicleEval && selectedVehicleEval.fits === false ? '2px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: selectedVehicleEval && selectedVehicleEval.fits === false ? '#fff5f5' : loadingVehicles ? '#f1f5f9' : 'white'
                    }}
                  >
                    <option value="">{loadingVehicles ? 'Evaluating suitable vehicles...' : '-- Choose Vehicle --'}</option>
                    {(() => {
                      const list: any[] = [...(vehiclesData?.data || [])];
                      const sv = vehiclesData?.suggestedVehicle;
                      if (sv && !list.some((x: any) => x.id === sv.id)) list.unshift(sv);
                      return list;
                    })().map((v: any) => {
                      const evaluation = vehiclesData?.evaluations?.find((e: any) => e.id === v.id);
                      const isSuggested = v.id === vehiclesData.suggestedVehicleId;
                      const doesNotFit = evaluation && evaluation.fits === false;
                      const isBusy = v.isBusy;
                      return (
                        <option key={v.id} value={v.id} disabled={isBusy} style={{ color: isBusy ? '#94a3b8' : doesNotFit ? '#dc2626' : 'inherit' }}>
                          {v.plateNumber ? `${v.plateNumber} · ` : ''}{v.vehicleType}
                          {isBusy ? ' — (In Use / Delivering)' : isSuggested ? ' — System Assigned (Recommended)' : doesNotFit ? ' — ⚠️ Does Not Fit!' : ' — Fits Cargo ✓'}
                        </option>
                      );
                    })}
                  </select>

                  {/* Warning Box when Selected Vehicle Will NOT Fit */}
                  {selectedVehicleEval && selectedVehicleEval.fits === false ? (
                    <div style={{
                      marginTop: '10px',
                      padding: '12px 16px',
                      background: '#fef2f2',
                      border: '1.5px solid #ef4444',
                      borderRadius: '10px',
                      color: '#991b1b',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px', color: '#b91c1c' }}>
                        <AlertTriangle size={18} />
                        <span>Warning: This Shipment Will NOT Fit in {selectedVehicleEval.vehicleType}!</span>
                      </div>
                      {vehiclesData?.suggestedVehicle && (
                        <div style={{
                          paddingTop: '8px',
                          borderTop: '1px solid #fecaca',
                          fontSize: '12px',
                          color: '#15803d',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '8px'
                        }}>
                          <span>System assigned vehicle: <strong>{vehiclesData.suggestedVehicle.vehicleType}</strong></span>
                          <button
                            type="button"
                            onClick={() => setVehicleId(vehiclesData.suggestedVehicle.id.toString())}
                            style={{
                              background: '#16a34a',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '5px 12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Switch to System Assigned Vehicle
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (selectedVehicleEval || vehiclesData?.suggestedVehicle) ? (
                    /* Box when Vehicle Fits or Default Assigned */
                    (() => {
                      const displayVeh = selectedVehicleEval || vehiclesData?.suggestedVehicle;
                      const isSuggested = displayVeh.id === vehiclesData?.suggestedVehicleId;
                      return (
                        <div style={{
                          marginTop: '10px',
                          padding: '12px 14px',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#166534',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px' }}>
                            <span>{isSuggested ? '🚚 System Assigned Vehicle:' : '✓ Selected Vehicle:'}</span>
                            <span>{displayVeh.vehicleType}</span>
                          </div>
                        </div>
                      );
                    })()
                  ) : null}
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
            disabled={!selectedOption || isSubmitting || (selectedOption === 'internal' && (!driverId || !vehicleId))}
            style={{
              padding: '10px 24px',
              backgroundColor: (selectedOption === 'internal' && selectedVehicleEval?.fits === false) ? '#d97706' : '#3b82f6',
              border: 'none',
              borderRadius: '8px',
              cursor: (!selectedOption || isSubmitting || (selectedOption === 'internal' && (!driverId || !vehicleId))) ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              color: 'white',
              opacity: (!selectedOption || isSubmitting || (selectedOption === 'internal' && (!driverId || !vehicleId))) ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSubmitting ? (
              'Dispatching...'
            ) : (selectedOption === 'internal' && selectedVehicleEval?.fits === false) ? (
              <>
                <AlertTriangle size={16} />
                <span>Confirm Dispatch (Proceed with Warning)</span>
              </>
            ) : (
              'Confirm Dispatch'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
