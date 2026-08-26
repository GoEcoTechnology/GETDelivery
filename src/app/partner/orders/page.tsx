import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, tenants, customers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { MapPin, Clock, Package } from 'lucide-react';
import styles from '../partner.module.css';

export const metadata = {
  title: 'My Orders | GET Delivery Partner',
};

function getStatusBadge(status: string) {
  switch (status) {
    case 'PENDING':
      return <span className={`${styles.badge} ${styles.badgeYellow}`}>New Request</span>;
    case 'TEMPORARY_WINNER':
      return <span className={`${styles.badge} ${styles.badgeBlue}`}>Awaiting Approval</span>;
    case 'ASSIGNED':
      return <span className={`${styles.badge} ${styles.badgeGreen}`}>Assigned</span>;
    case 'DECLINED':
      return <span className={`${styles.badge} ${styles.badgeRed}`}>Declined</span>;
    case 'EXPIRED':
      return <span className={`${styles.badge} ${styles.badgeGray}`}>Expired</span>;
    default:
      return <span className={`${styles.badge} ${styles.badgeGray}`}>{status}</span>;
  }
}

export default async function PartnerOrdersPage() {
  const headersList = await headers();
  const partnerIdStr = headersList.get('x-partner-id');
  const role = headersList.get('x-user-role');

  if (!partnerIdStr || role !== 'DELIVERY_PARTNER') {
    redirect('/login');
  }

  const partnerId = parseInt(partnerIdStr, 10);

  // Fetch all invitations for this partner, joined with order details
  const invitations = await db
    .select({
      invitation: deliveryInvitations,
      order: deliveryOrders,
      tenant: tenants,
      customer: customers
    })
    .from(deliveryInvitations)
    .innerJoin(deliveryOrders, eq(deliveryInvitations.deliveryOrderId, deliveryOrders.id))
    .innerJoin(tenants, eq(deliveryInvitations.tenantId, tenants.id))
    .leftJoin(customers, eq(deliveryOrders.customerId, customers.id))
    .where(eq(deliveryInvitations.deliveryPartnerId, partnerId))
    .orderBy(desc(deliveryInvitations.createdAt));

  return (
    <div style={{ paddingBottom: '64px' }}>
      <div className={styles.flexBetween} style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Delivery Inbox</h1>
      </div>

      <div>
        {invitations.length === 0 ? (
          <div className={styles.emptyState}>
            <Package size={48} color="#cbd5e1" style={{ margin: '0 auto' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginTop: '16px' }}>No requests</h3>
            <p className={styles.textMuted} style={{ marginTop: '4px' }}>You don't have any delivery requests yet.</p>
          </div>
        ) : (
          invitations.map(({ invitation, order, tenant, customer }) => (
            <Link key={invitation.id} href={`/partner/orders/${order.id}`} style={{ textDecoration: 'none' }}>
              <div className={styles.card} style={{ borderLeft: '4px solid #4f46e5' }}>
                <div className={styles.cardHeader}>
                  <div className={styles.flexBetween}>
                    <h3 className={styles.cardTitle}>{tenant.name}</h3>
                    {getStatusBadge(invitation.status)}
                  </div>
                  <div className={styles.textMuted} style={{ marginTop: '4px' }}>
                    Order #{order.id} • {new Date(invitation.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className={styles.cardContent}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <MapPin size={20} color="#4f46e5" style={{ marginTop: '2px', flexShrink: 0 }} />
                      <div style={{ fontSize: '14px' }}>
                        <p style={{ fontWeight: 500, color: '#0f172a', margin: '0 0 2px 0' }}>Delivery to:</p>
                        <p className={styles.textMuted} style={{ margin: 0 }}>{order.dropoffAddress}</p>
                      </div>
                    </div>
                    {customer && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <Clock size={20} color="#94a3b8" style={{ marginTop: '2px', flexShrink: 0 }} />
                        <div style={{ fontSize: '14px', color: '#475569' }}>
                          {customer.name}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
