'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Package, Phone, X, ChevronRight, Calendar, User, Navigation } from 'lucide-react';
import styles from '../partner.module.css';

type OrderInvitationItem = {
  invitation: { id: number; createdAt: string | Date; status: string };
  order: { id: number; dropoffAddress: string; instructions?: string; preferredVehicle?: string; finalDeliveryPrice?: string | number; requiredVehicleType?: string; distanceKm?: string | number; vehicleBasePrice?: string | number; pricePerKm?: string | number; pickupAddress?: string };
  tenant: { name: string };
  customer?: { name: string; mobileNumber?: string | null } | null;
  items?: Array<{ quantity: number; unit: string; productName: string }>;
};

function getStatusDisplay(status: string) {
  if (status === 'TEMPORARY_WINNER') return 'Selected Delivery Partner';
  return status.replace(/_/g, ' ');
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'PENDING': return <span className={`${styles.badge} ${styles.badgeYellow}`} style={{ padding: '6px 12px', fontSize: '13px' }}>New Request</span>;
    case 'TEMPORARY_WINNER': return <span className={`${styles.badge} ${styles.badgeBlue}`} style={{ padding: '6px 12px', fontSize: '13px' }}>Selected Delivery Partner</span>;
    case 'ASSIGNED': return <span className={`${styles.badge} ${styles.badgeGreen}`} style={{ padding: '6px 12px', fontSize: '13px' }}>Assigned</span>;
    case 'DECLINED': return <span className={`${styles.badge} ${styles.badgeRed}`} style={{ padding: '6px 12px', fontSize: '13px' }}>Declined</span>;
    case 'EXPIRED': return <span className={`${styles.badge} ${styles.badgeGray}`} style={{ padding: '6px 12px', fontSize: '13px' }}>Expired</span>;
    default: return <span className={`${styles.badge} ${styles.badgeGray}`} style={{ padding: '6px 12px', fontSize: '13px' }}>{getStatusDisplay(status)}</span>;
  }
}

export default function OrdersTableClient({ invitations }: { invitations: OrderInvitationItem[] }) {
  const [selectedOrder, setSelectedOrder] = useState<OrderInvitationItem | null>(null);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {invitations.length === 0 ? (
        <div className={styles.emptyState} style={{ background: '#fff', borderRadius: '16px', padding: '48px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <Package size={48} color="#cbd5e1" style={{ margin: '0 auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '16px' }}>No requests</h3>
          <p className={styles.textMuted} style={{ marginTop: '4px', fontSize: '15px' }}>You do not have any delivery requests yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {invitations.map((item) => (
            <div key={item.invitation.id} style={{ 
              background: '#fff', 
              borderRadius: '20px', 
              border: '1px solid #e2e8f0',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer'
            }}
            onClick={() => setSelectedOrder(item)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
            }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.tenant.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', color: '#0f172a', fontWeight: 700, fontSize: '16px' }}>
                    <User size={16} color="#4f46e5" />
                    {item.customer ? item.customer.name : 'Unknown Customer'}
                  </div>
                </div>
                {getStatusBadge(item.invitation.status)}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#f8fafc', borderRadius: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <Navigation size={16} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ color: '#334155', fontSize: '14px', lineHeight: 1.4 }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>To: </span>{item.order.dropoffAddress}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Calendar size={16} color="#64748b" style={{ flexShrink: 0 }} />
                  <div style={{ color: '#475569', fontSize: '14px' }}>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>Delivery Date: </span>{new Date(item.invitation.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ color: '#64748b', fontSize: '13px' }}>ID: #{item.order.id}</div>
                <button style={{ 
                  color: '#4f46e5', 
                  fontWeight: 700, 
                  background: '#eff6ff', 
                  border: 'none', 
                  cursor: 'pointer', 
                  fontSize: '14px', 
                  padding: '8px 16px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background 0.2s'
                }}>
                  View Details <ChevronRight size={16} />
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }} onClick={() => setSelectedOrder(null)}>
          <div style={{ background: '#fff', borderRadius: '24px', width: 'min(920px, 100%)', maxHeight: 'min(90vh, 760px)', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', display: 'grid', gridTemplateRows: 'auto 1fr auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: 800 }}>Delivery Details</h2>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>Review the request before opening the full order page.</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '999px', width: 40, height: 40, display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}><X size={20} color="#64748b" /></button>
            </div>

            <div style={{ padding: '32px', overflow: 'auto', background: '#fff' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                <div style={{ display: 'grid', gap: '24px' }}>
                  <Panel title="Route Information">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Pickup</div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{selectedOrder.order.pickupAddress || selectedOrder.tenant.name}</div>
                      </div>
                      <div style={{ width: '2px', height: '24px', background: '#e2e8f0', margin: '0 12px' }} />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Dropoff</div>
                        <div style={{ color: '#334155', fontWeight: 600 }}>{selectedOrder.order.dropoffAddress}</div>
                      </div>
                    </div>
                    
                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0', display: 'grid', gap: '12px' }}>
                      <Field label="Required vehicle" value={selectedOrder.order.requiredVehicleType || selectedOrder.order.preferredVehicle || '-'} />
                      <Field label="Distance" value={selectedOrder.order.distanceKm ? `${selectedOrder.order.distanceKm} km` : '-'} />
                      <Field label="Delivery fee" value={selectedOrder.order.finalDeliveryPrice ? formatCurrency(selectedOrder.order.finalDeliveryPrice) : '-'} highlight />
                    </div>
                  </Panel>

                  <Panel title="Order Items">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {selectedOrder.items?.length ? selectedOrder.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontWeight: 500, color: '#334155' }}>{item.productName}</span>
                          <span style={{ fontWeight: 800, color: '#0f172a', background: '#fff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}>x{item.quantity} {item.unit}</span>
                        </div>
                      )) : <div style={{ color: '#64748b', fontStyle: 'italic', padding: '12px' }}>No products listed</div>}
                    </div>
                  </Panel>
                </div>
                
                <div style={{ display: 'grid', gap: '24px', alignContent: 'start' }}>
                  <Panel title="Request Info">
                    <Field label="Status" value={getStatusDisplay(selectedOrder.invitation.status)} badge />
                    <Field label="Created" value={new Date(selectedOrder.invitation.createdAt).toLocaleDateString()} />
                  </Panel>

                  {selectedOrder.customer && (
                    <Panel title="Customer Details">
                      <Field label="Name" value={selectedOrder.customer.name} />
                      {selectedOrder.customer.mobileNumber && <Field label="Contact" value={selectedOrder.customer.mobileNumber} />}
                    </Panel>
                  )}

                  {selectedOrder.order.instructions && (
                    <Panel title="Special Instructions">
                      <div style={{ color: '#475569', lineHeight: 1.6, background: '#fef3c7', padding: '16px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                        {selectedOrder.order.instructions}
                      </div>
                    </Panel>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '24px 32px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>Manage the full order after reviewing this summary.</div>
              <Link href={`/partner/orders/${selectedOrder.order.id}`} style={{ padding: '14px 28px', background: '#4f46e5', color: '#fff', textDecoration: 'none', borderRadius: '14px', fontWeight: 700, boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.3)', transition: 'background 0.2s, transform 0.1s' }}>
                Manage Order
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '4px', height: '16px', background: '#4f46e5', borderRadius: '4px' }} />
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, highlight, badge }: { label: string; value: string; highlight?: boolean; badge?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '12px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
      <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>{label}</span>
      {badge ? (
        <span style={{ fontWeight: 700, color: '#4f46e5', background: '#eff6ff', padding: '4px 12px', borderRadius: '999px', fontSize: '13px' }}>{value}</span>
      ) : (
        <span style={{ fontWeight: highlight ? 800 : 600, color: highlight ? '#0f172a' : '#334155', textAlign: 'right', fontSize: highlight ? '18px' : '14px' }}>{value}</span>
      )}
    </div>
  );
}

function formatCurrency(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}
