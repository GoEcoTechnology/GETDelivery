'use client';
import { X, Phone, Mail, MapPin, Package, User, Truck } from 'lucide-react';
import styles from '../admin.module.css';
import { useEffect } from 'react';

type DeliveryDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  delivery: any;
  addQuotaInputs: Record<string, number>;
  setAddQuotaInputs: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  addQuotaErrors: Record<string, string>;
  setAddQuotaErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleAddQuota: (deliveryId: number, productId: number, targetQty: number, currentQty: number) => void;
  isAdding: (deliveryId: number, productId: number) => boolean;
  onDispatch?: () => void;
};

function formatCurrency(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

export function DeliveryDetailsModal({
  isOpen,
  onClose,
  delivery,
  addQuotaInputs,
  setAddQuotaInputs,
  addQuotaErrors,
  setAddQuotaErrors,
  handleAddQuota,
  isAdding,
  onDispatch
}: DeliveryDetailsModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !delivery) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, padding: '20px'
    }}>
      <div className={styles.fadeIn} style={{
        backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '900px',
        maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Delivery Details</h2>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>Ref: {delivery.trackingNumber || delivery.id}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {delivery.status === 'READY_FOR_DISPATCH' && onDispatch && (
              <button 
                onClick={onDispatch}
                style={{ padding: '8px 16px', background: '#10b981', color: 'white', borderRadius: '10px', border: 'none', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Truck size={14} /> Dispatch Order
              </button>
            )}
            <button onClick={onClose} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
            {/* Customer Info */}
            <section>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} /> Customer Information
              </h3>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>{delivery.customerName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontSize: '0.875rem', marginTop: '4px' }}>
                  <Phone size={14} /> {delivery.customerContact || 'No contact provided'}
                </div>
              </div>
            </section>

          {/* Products & Quotas */}
          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={14} /> Products & Quota
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {delivery.products && delivery.products.length > 0 ? (
                delivery.products.map((prod: any, idx: number) => {
                  const accQty = prod.accumulatedQuantity || 0;
                  const targetQty = prod.targetQuantity || 20;
                  const pct = Math.min(100, (accQty / targetQty) * 100);
                  const isReached = accQty >= targetQty;
                  const remaining = targetQty - accQty;
                  const canAddQuota = !['READY_FOR_DISPATCH', 'DISPATCHED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(delivery.status);
                  const inputKey = `${delivery.id}-${prod.productId}-${idx}`;
                  const inputQty = addQuotaInputs[inputKey] || 0;
                  const errorMsg = addQuotaErrors[inputKey];
                  const adding = isAdding(delivery.id, prod.productId);

                  return (
                    <div key={idx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>{prod.productName}</div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: isReached ? '#16a34a' : '#3b82f6' }}>
                          {accQty} / {targetQty} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>units</span>
                        </div>
                      </div>

                      <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', width: '100%', marginBottom: '16px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: isReached ? '#16a34a' : '#3b82f6', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                      </div>

                      {!isReached && canAddQuota && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', borderTop: '1px dashed #e2e8f0', paddingTop: '12px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Add to quota:</span>
                          <input
                            type="number" min={1} max={remaining}
                            value={inputQty || ''}
                            onChange={e => {
                              const v = parseInt(e.target.value, 10);
                              setAddQuotaInputs(prev => ({ ...prev, [inputKey]: isNaN(v) ? 0 : v }));
                              setAddQuotaErrors(prev => ({ ...prev, [inputKey]: '' }));
                            }}
                            placeholder="Qty"
                            style={{ width: '60px', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.875rem', textAlign: 'center' }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddQuota(delivery.id, prod.productId, targetQty, accQty);
                            }}
                            disabled={adding || remaining <= 0}
                            style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                          >
                            {adding ? 'Adding...' : 'Add'}
                          </button>
                        </div>
                      )}
                      {errorMsg && canAddQuota && <div style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '8px', textAlign: 'right' }}>{errorMsg}</div>}
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                  No products attached to this delivery.
                </div>
              )}
            </div>
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
          {/* Location & Pricing */}
          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} /> Location & Pricing
            </h3>
            <div style={{ display: 'grid', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '5px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>PICKUP</div>
                  <div style={{ color: '#0f172a', fontSize: '0.875rem', lineHeight: 1.4 }}>{delivery.pickupAddress}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981', marginTop: '5px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>DROPOFF</div>
                  <div style={{ color: '#0f172a', fontSize: '0.875rem', lineHeight: 1.4 }}>{delivery.dropoffAddress}</div>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>VEHICLE REQUIRED</div>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{delivery.requiredVehicleType || 'Any'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>DELIVERY FEE</div>
                  <div style={{ fontWeight: 700, color: '#10b981', fontSize: '1.125rem' }}>
                    {delivery.finalDeliveryPrice != null ? formatCurrency(delivery.finalDeliveryPrice) : 'TBD'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Delivery Partner */}
          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Truck size={14} /> Assigned Partner
            </h3>
            {delivery.temporaryWinner ? (
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>PARTNER COMPANY</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>
                    {delivery.temporaryWinner.companyName || delivery.temporaryWinner.contactPerson || 'Delivery Partner'}
                  </div>
                  {delivery.temporaryWinner.mobileNumber && (
                    <div style={{ fontSize: '0.875rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <Phone size={14} /> {delivery.temporaryWinner.mobileNumber}
                    </div>
                  )}
                  {delivery.temporaryWinner.email && (
                    <div style={{ fontSize: '0.875rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <Mail size={14} /> {delivery.temporaryWinner.email}
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>ASSIGNED DRIVER</div>
                  {delivery.partnerDriverName ? (
                    <>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>{delivery.partnerDriverName}</div>
                      {delivery.partnerDriverContact && (
                        <div style={{ fontSize: '0.875rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                          <Phone size={14} /> {delivery.partnerDriverContact}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      Waiting for partner to assign driver
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.875rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                No delivery partner assigned yet.
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
    </div>
  );
}
