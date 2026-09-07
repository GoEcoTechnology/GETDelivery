import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { notifications, deliveryOrders } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Bell, Link, Package, MapPin, User, Phone } from 'lucide-react';
import styles from '../partner.module.css';

export const metadata = {
  title: 'Notifications | GET Delivery Partner',
};

export default async function PartnerNotificationsPage() {
  const headersList = await headers();
  const partnerIdStr = headersList.get('x-partner-id');
  const role = headersList.get('x-user-role');

  if (!partnerIdStr || role !== 'DELIVERY_PARTNER') {
    redirect('/login');
  }

  const partnerId = parseInt(partnerIdStr, 10);

  const partnerNotifications = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.receiverId, partnerId),
        eq(notifications.receiverRole, 'DELIVERY_PARTNER')
      )
    )
    .orderBy(desc(notifications.createdAt));

  // Fetch delivery order details for each notification
  const notificationsWithOrders = await Promise.all(
    partnerNotifications.map(async (notif) => {
      let order = null;
      if (notif.deliveryOrderId) {
        const [foundOrder] = await db
          .select()
          .from(deliveryOrders)
          .where(eq(deliveryOrders.id, notif.deliveryOrderId));
        order = foundOrder;
      }
      return { notif, order };
    })
  );

  // Mark all as read
  if (partnerNotifications.some(n => n.status === 'UNREAD')) {
    await db
      .update(notifications)
      .set({ status: 'READ', readAt: new Date() })
      .where(
        and(
          eq(notifications.receiverId, partnerId),
          eq(notifications.receiverRole, 'DELIVERY_PARTNER'),
          eq(notifications.status, 'UNREAD')
        )
      );
  }

  const getNotificationBadgeColor = (type: string) => {
    const colorMap: Record<string, string> = {
      new_delivery_request: '#10b981',
      order_accepted: '#3b82f6',
      order_declined: '#ef4444',
      delivery_completed: '#8b5cf6',
      order_assigned: '#f59e0b',
    };
    return colorMap[type] || '#6b7280';
  };

  const formatNotificationType = (type: string) => {
    const typeMap: Record<string, string> = {
      new_delivery_request: 'New Request',
      order_accepted: 'Accepted',
      order_declined: 'Declined',
      delivery_completed: 'Completed',
      order_assigned: 'Assigned',
    };
    return typeMap[type] || type;
  };

  return (
    <div style={{ paddingBottom: '64px' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {notificationsWithOrders.length === 0 ? (
          <div className={styles.emptyState}>
            <Bell size={48} color="#cbd5e1" style={{ margin: '0 auto' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginTop: '16px' }}>All caught up</h3>
            <p className={styles.textMuted} style={{ marginTop: '4px' }}>You don't have any notifications.</p>
            <Link href="/partner" className={styles.textMuted} style={{ marginTop: '4px' }}>Back to Dashboard</Link>
          </div>
        ) : (
          notificationsWithOrders.map(({ notif, order }) => (
            <div key={notif.id} className={styles.card} style={{ marginBottom: 0, backgroundColor: notif.status === 'UNREAD' ? '#e0e7ff' : 'white' }}>
              <div className={styles.cardContent} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ marginTop: '4px', height: '8px', width: '8px', borderRadius: '50%', flexShrink: 0, backgroundColor: notif.status === 'UNREAD' ? '#4f46e5' : 'transparent' }} />
                <div style={{ flex: 1 }}>
                  {/* Header with Title and Badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>{notif.title}</h4>
                    <span style={{ 
                      display: 'inline-block',
                      backgroundColor: getNotificationBadgeColor(notif.notificationType),
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      flexShrink: 0
                    }}>
                      {formatNotificationType(notif.notificationType)}
                    </span>
                  </div>

                  {/* Notification Message */}
                  <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0 0 12px 0', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{notif.body}</p>

                  {/* Timestamp */}
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                    {new Date(notif.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
