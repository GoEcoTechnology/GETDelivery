'use client';
import { X, MapPin, Package, Truck, Phone, Mail, UserPlus, Users, DollarSign } from 'lucide-react';
import styles from '../admin.module.css';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

type DeliveryDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  delivery: any;
  onAddCustomer?: (deliveryId: number, itemId: number, productId: number, variantId: number, productName: string, variantName: string, unit: string | null, sellingUnits: any[], targetQuantity: number, currentAccumulated: number, pickupAddress: string) => void;
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
  onAddCustomer,
  onDispatch
}: DeliveryDetailsModalProps) {
  // Prevent background scrolling
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['delivery-customers', delivery?.id],
    queryFn: async () => {
      if (!delivery?.id) return [];
      const res = await fetch(`/api/deliveries/${delivery.id}/customers`);
      if (!res.ok) throw new Error('Failed to fetch customers');
      const json = await res.json();
      return json.data || [];
    },
    enabled: isOpen && !!delivery?.id,
  });

  const productTotal = delivery?.products?.reduce((sum: number, item: any) => {
    return sum + (item.accumulatedQuantity * (Number(item.unitPrice) || 0));
  }, 0) || 0;

  const deliveryFee = Number(delivery?.finalDeliveryPrice) || Number(delivery?.offeredAmount) || 0;
  const totalAmount = productTotal + deliveryFee;

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


          {/* Products & Quotas */}
          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Package size={14} /> Products & Quota
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {delivery.products && delivery.products.length > 0 ? (
                delivery.products.map((prod: any, idx: number) => {
                  const accQty = prod.accumulatedQuantity || 0;
                  const targetQty = prod.targetQuantity || 0;
                  const pct = Math.min(100, targetQty > 0 ? (accQty / targetQty) * 100 : 0);
                  const isReached = accQty >= targetQty && targetQty > 0;
                  const canAddQuota = !['READY_FOR_DISPATCH', 'WAITING_FOR_PARTNER', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED'].includes(delivery.status);

                  return (
                    <div key={idx} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                          {prod.productName}
                          {prod.variantName ? ` - ${prod.variantName}` : ''}
                          {prod.unit ? ` (${prod.unit})` : ''}
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: isReached ? '#16a34a' : '#3b82f6' }}>
                          {accQty} / {targetQty} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>units</span>
                        </div>
                      </div>

                      <div style={{ height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', width: '100%', marginBottom: '16px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: isReached ? '#16a34a' : '#3b82f6', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                      </div>

                      {canAddQuota && !isReached && onAddCustomer && (
                        <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => onAddCustomer(
                              delivery.id,
                              prod.itemId,
                              prod.productId,
                              prod.variantId || 0,
                              prod.productName,
                              prod.variantName || '',
                              prod.unit || null,
                              prod.sellingUnits || [],
                              targetQty,
                              accQty,
                              delivery.pickupAddress
                            )}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '7px 14px',
                              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                              color: 'white', border: 'none', borderRadius: '8px',
                              fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
                              transition: 'opacity 0.15s'
                            }}
                          >
                            <UserPlus size={14} /> Add Customer
                          </button>
                        </div>
                      )}
                      {isReached && (
                        <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '12px', textAlign: 'right' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#16a34a' }}>✓ Quota Reached</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  No products in this delivery order.
                </div>
              )}
            </div>

            {/* Customers Section */}
            {customersData && customersData.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={14} /> Added Customers
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  {customersData.map((cust: any, i: number) => (
                    <div key={cust.id} style={{ padding: '12px 16px', borderBottom: i < customersData.length - 1 ? '1px solid #e2e8f0' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem', marginBottom: '4px' }}>
                          {cust.customerName}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          {cust.customerContact && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {cust.customerContact}</span>}
                          {cust.address && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} /> {cust.address}</span>}
                          {cust.landmark && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '12px', border: '1px solid #fde68a', marginTop: '2px' }}>Landmark: {cust.landmark}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {cust.items?.map((item: any, idx: number) => (
                          <div key={idx} style={{ fontSize: '13px', fontWeight: 500, color: '#1e293b' }}>
                            {item.quantity} {item.unit} <span style={{ color: '#64748b', fontWeight: 400 }}>{item.productName}{item.variantName ? ` - ${item.variantName}` : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
          {/* Location */}
          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={14} /> Location
            </h3>
            <div style={{ display: 'grid', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '5px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '2px' }}>PICKUP</div>
                  <div style={{ color: '#0f172a', fontSize: '0.875rem', lineHeight: 1.4 }}>{delivery.pickupAddress}</div>
                </div>
              </div>
            </div>
          </section>

          {/* Delivery Partner / Internal Assignment */}
          {!delivery.internalAssignment ? (
            <section>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={14} /> Assigned To
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
                Not assigned yet.
              </div>
            )}
          </section>
          ) : (
            <section>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Truck size={14} /> Internal Transport
              </h3>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'grid', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>ASSIGNED DRIVER</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>
                    {delivery.internalAssignment.driverName}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>VEHICLE</div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                    {delivery.internalAssignment.vehicleDetails}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Payment Summary */}
          <section>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={14} /> Payment Summary
            </h3>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569' }}>
                <span>Products Total</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(productTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#475569' }}>
                <span>Delivery Fee</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{formatCurrency(deliveryFee)}</span>
              </div>
              <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700, color: '#1d4ed8' }}>
                <span>Total Amount</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
    </div>
  );
}

