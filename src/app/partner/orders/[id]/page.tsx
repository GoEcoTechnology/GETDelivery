import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, tenants, customers, deliveryItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import PartnerOrderActions from './PartnerOrderActions';
import { MapPin, User, Package, Calendar, Phone } from 'lucide-react';
import styles from '../../partner.module.css';

export default async function PartnerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const partnerIdStr = headersList.get('x-partner-id');
  const role = headersList.get('x-user-role');
  const orderId = parseInt((await params).id, 10);

  if (!partnerIdStr || role !== 'DELIVERY_PARTNER' || isNaN(orderId)) {
    redirect('/login');
  }

  const partnerId = parseInt(partnerIdStr, 10);

  // Fetch the invitation to get status and ensure the partner has access
  const [invitation] = await db
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
    .where(
      and(
        eq(deliveryInvitations.deliveryPartnerId, partnerId),
        eq(deliveryInvitations.deliveryOrderId, orderId)
      )
    );

  if (!invitation) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626' }}>Access Denied</h2>
        <p style={{ marginTop: '8px', color: '#475569' }}>You don't have access to this order or it doesn't exist.</p>
      </div>
    );
  }

  const { order, tenant, customer, invitation: invite } = invitation;

  // Fetch items
  const items = await db.select().from(deliveryItems).where(eq(deliveryItems.deliveryOrderId, order.id));

  return (
    <div style={{ paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <div className={styles.flexBetween} style={{ marginBottom: '8px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Order #{order.id}</h1>
          <span className={`${styles.badge} ${invite.status === 'PENDING' ? styles.badgeYellow : styles.badgeGray}`}>
            {invite.status.replace(/_/g, ' ')}
          </span>
        </div>
        <p className={styles.textMuted}>From {tenant.name}</p>
      </div>

      {/* Action Buttons (Sticky at bottom for mobile) */}
      <PartnerOrderActions orderId={order.id} status={invite.status} />

      {/* Delivery Details */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} color="#4f46e5" />
            Delivery Details
          </h3>
        </div>
        <div className={styles.cardContent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <p className={styles.textMuted}>Destination</p>
            <p style={{ fontWeight: 500, margin: '4px 0 0 0' }}>{order.dropoffAddress}</p>
          </div>
          {order.instructions && (
            <div>
              <p className={styles.textMuted}>Instructions</p>
              <p style={{ fontSize: '14px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #f1f5f9', margin: '4px 0 0 0' }}>
                {order.instructions}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Customer Details */}
      {customer && (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={20} color="#4f46e5" />
              Customer Information
            </h3>
          </div>
          <div className={styles.cardContent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className={styles.flexBetween}>
              <span style={{ color: '#475569' }}>Name</span>
              <span style={{ fontWeight: 500 }}>{customer.name}</span>
            </div>
            {customer.mobileNumber && (
              <div className={styles.flexBetween}>
                <span style={{ color: '#475569' }}>Contact</span>
                <span style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={14} /> {customer.mobileNumber}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={20} color="#4f46e5" />
            Items ({items.reduce((sum, item) => sum + item.quantity, 0)})
          </h3>
        </div>
        <div className={styles.cardContent}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map(item => (
              <li key={item.id} className={styles.flexBetween} style={{ paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#0f172a' }}>Product #{item.productId}</span>
                <span style={{ color: '#64748b', fontWeight: 500 }}>x{item.quantity} {item.unit || ''}</span>
              </li>
            ))}
            {items.length === 0 && <li style={{ padding: '8px 0', color: '#64748b' }}>No specific items listed.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
