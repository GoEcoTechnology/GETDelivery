'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPin, Package, Phone, X, ChevronRight } from 'lucide-react';
import styles from '../partner.module.css';

type OrderInvitationItem = {
  invitation: { id: number; createdAt: string | Date; status: string };
  order: { id: number; dropoffAddress: string; instructions?: string; preferredVehicle?: string; finalDeliveryPrice?: string | number; requiredVehicleType?: string; distanceKm?: string | number; vehicleBasePrice?: string | number; pricePerKm?: string | number; pickupAddress?: string };
  tenant: { name: string };
  customer?: { name: string; mobileNumber?: string | null } | null;
  items?: Array<{ quantity: number; unit: string; productName: string }>;
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'PENDING': return <span className={`${styles.badge} ${styles.badgeYellow}`}>New Request</span>;
    case 'TEMPORARY_WINNER': return <span className={`${styles.badge} ${styles.badgeBlue}`}>Awaiting Approval</span>;
    case 'ASSIGNED': return <span className={`${styles.badge} ${styles.badgeGreen}`}>Assigned</span>;
    case 'DECLINED': return <span className={`${styles.badge} ${styles.badgeRed}`}>Declined</span>;
    case 'EXPIRED': return <span className={`${styles.badge} ${styles.badgeGray}`}>Expired</span>;
    default: return <span className={`${styles.badge} ${styles.badgeGray}`}>{status}</span>;
  }
}

export default function OrdersTableClient({ invitations }: { invitations: OrderInvitationItem[] }) {
  const [selectedOrder, setSelectedOrder] = useState<OrderInvitationItem | null>(null);

  return (
    <div className={styles.tableContainer} style={{ overflowX: 'auto', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
      {invitations.length === 0 ? (
        <div className={styles.emptyState}>
          <Package size={48} color="#cbd5e1" style={{ margin: '0 auto' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginTop: '16px' }}>No requests</h3>
          <p className={styles.textMuted} style={{ marginTop: '4px' }}>You do not have any delivery requests yet.</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '13px' }}>Tenant</th>
              <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '13px' }}>Customer</th>
              <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '13px' }}>Dropoff Address</th>
              <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '13px' }}>Date</th>
              <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '13px' }}>Status</th>
              <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '13px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((item) => (
              <tr key={item.invitation.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '16px', color: '#0f172a', fontSize: '14px', fontWeight: 600 }}>{item.tenant.name}</td>
                <td style={{ padding: '16px', color: '#475569', fontSize: '14px' }}>{item.customer ? item.customer.name : '-'}</td>
                <td style={{ padding: '16px', color: '#475569', fontSize: '14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={16} color="#4f46e5" />{item.order.dropoffAddress}</div></td>
                <td style={{ padding: '16px', color: '#475569', fontSize: '14px' }}>{new Date(item.invitation.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '16px' }}>{getStatusBadge(item.invitation.status)}</td>
                <td style={{ padding: '16px' }}>
                  <button onClick={() => setSelectedOrder(item)} style={{ color: '#4f46e5', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', padding: 0 }}>
                    View <ChevronRight size={14} style={{ display: 'inline' }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedOrder && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: 'min(920px, 100%)', maxHeight: 'min(90vh, 760px)', overflow: 'hidden', boxShadow: '0 30px 80px rgba(15,23,42,0.25)', display: 'grid', gridTemplateRows: 'auto 1fr auto' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>Delivery Details</h2>
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>Review the request before opening the full order page.</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} style={{ border: 'none', background: '#f8fafc', borderRadius: '999px', width: 36, height: 36, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '22px', overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '16px' }}>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <Panel title="Route">
                    <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{selectedOrder.order.pickupAddress || selectedOrder.tenant.name}</div>
                    <div style={{ color: '#64748b', fontSize: '14px', marginBottom: 10 }}>To {selectedOrder.order.dropoffAddress}</div>
                    <Field label="Required vehicle" value={selectedOrder.order.requiredVehicleType || selectedOrder.order.preferredVehicle || '-'} />
                    <Field label="Distance" value={selectedOrder.order.distanceKm ? `${selectedOrder.order.distanceKm} km` : '-'} />
                    <Field label="Delivery fee" value={selectedOrder.order.finalDeliveryPrice ? formatCurrency(selectedOrder.order.finalDeliveryPrice) : '-'} />
                  </Panel>
                  <Panel title="Items">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {selectedOrder.items?.length ? selectedOrder.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', background: '#f8fafc' }}>
                          <span>{item.productName}</span><span style={{ fontWeight: 700 }}>x{item.quantity} {item.unit}</span>
                        </div>
                      )) : <div style={{ color: '#64748b' }}>No products listed</div>}
                    </div>
                  </Panel>
                </div>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <Panel title="Request Info">
                    <Field label="Status" value={selectedOrder.invitation.status.replace(/_/g, ' ')} />
                    <Field label="Created" value={new Date(selectedOrder.invitation.createdAt).toLocaleDateString()} />
                  </Panel>
                  {selectedOrder.customer && (
                    <Panel title="Customer">
                      <Field label="Name" value={selectedOrder.customer.name} />
                      {selectedOrder.customer.mobileNumber && <Field label="Contact" value={selectedOrder.customer.mobileNumber} />}
                    </Panel>
                  )}
                  {selectedOrder.order.instructions && (
                    <Panel title="Instructions">
                      <div style={{ color: '#334155', lineHeight: 1.6 }}>{selectedOrder.order.instructions}</div>
                    </Panel>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '18px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ color: '#64748b', fontSize: '13px' }}>Manage the full order after reviewing this summary.</div>
              <Link href={`/partner/orders/${selectedOrder.order.id}`} style={{ padding: '12px 18px', background: '#4f46e5', color: '#fff', textDecoration: 'none', borderRadius: '12px', fontWeight: 700 }}>Manage Order</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px' }}><div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>{title}</div>{children}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}><span style={{ color: '#64748b' }}>{label}</span><span style={{ fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>{value}</span></div>;
}

function formatCurrency(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}
