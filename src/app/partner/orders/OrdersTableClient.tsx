'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  if (status === 'TEMPORARY_WINNER' || status === 'ASSIGNED') return 'ACCEPTED';
  if (status === 'DISPATCHED' || status === 'PENDING') return 'AVAILABLE';
  if (status === 'IN_TRANSIT') return 'IN TRANSIT';
  return status.replace(/_/g, ' ');
}

function getStatusBadge(status: string) {
  const displayStatus = getStatusDisplay(status).toUpperCase();
  switch (displayStatus) {
    case 'AVAILABLE': return <span className={`${styles.badge} ${styles.badgeYellow}`} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 800 }}>AVAILABLE</span>;
    case 'ACCEPTED': return <span className={`${styles.badge} ${styles.badgeBlue}`} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 800 }}>ACCEPTED</span>;
    case 'IN TRANSIT': return <span className={`${styles.badge} ${styles.badgeBlue}`} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 800 }}>IN TRANSIT</span>;
    case 'DELIVERED': return <span className={`${styles.badge} ${styles.badgeBlue}`} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 800, background: '#dcfce7', color: '#16a34a' }}>DELIVERED</span>;
    case 'DECLINED': return <span className={`${styles.badge} ${styles.badgeRed}`} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 800 }}>DECLINED</span>;
    case 'EXPIRED': return <span className={`${styles.badge} ${styles.badgeGray}`} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 800 }}>EXPIRED</span>;
    case 'CANCELLED': return <span className={`${styles.badge} ${styles.badgeGray}`} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 800 }}>CANCELLED</span>;
    default: return <span className={`${styles.badge} ${styles.badgeGray}`} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: 800 }}>{displayStatus}</span>;
  }
}

export default function OrdersTableClient({ invitations, partnerCompanyName = 'You', basePath = '/partner/orders' }: { invitations: OrderInvitationItem[], partnerCompanyName?: string, basePath?: string }) {
  const router = useRouter();

  const filteredInvitations = invitations.filter(inv => inv.invitation.status?.toUpperCase() !== 'CANCELLED');

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {filteredInvitations.length === 0 ? (
        <div className={styles.emptyState} style={{ background: '#fff', borderRadius: '16px', padding: '48px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <Package size={48} color="#cbd5e1" style={{ margin: '0 auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginTop: '16px' }}>No requests</h3>
          <p className={styles.textMuted} style={{ marginTop: '4px', fontSize: '15px' }}>You do not have any delivery requests yet.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {filteredInvitations.map((item) => (
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
              onClick={() => router.push(`${basePath}/${item.order.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)';
              }}>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                {getStatusBadge(item.invitation.status)}
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Delivery for {item.tenant.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: 600, fontSize: '14px' }}>
                  <User size={14} color="#475569" />
                  {item.customer ? item.customer.name : 'Unknown Customer'}
                </div>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
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
