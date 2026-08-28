import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Bell } from 'lucide-react';
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

  return (
    <div style={{ paddingBottom: '64px' }}>
      <div className={styles.flexBetween} style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Notifications</h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {partnerNotifications.length === 0 ? (
          <div className={styles.emptyState}>
            <Bell size={48} color="#cbd5e1" style={{ margin: '0 auto' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginTop: '16px' }}>All caught up</h3>
            <p className={styles.textMuted} style={{ marginTop: '4px' }}>You don't have any notifications.</p>
          </div>
        ) : (
          partnerNotifications.map(notif => (
            <div key={notif.id} className={styles.card} style={{ marginBottom: 0, backgroundColor: notif.status === 'UNREAD' ? '#e0e7ff' : 'white' }}>
              <div className={styles.cardContent} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ marginTop: '4px', height: '8px', width: '8px', borderRadius: '50%', flexShrink: 0, backgroundColor: notif.status === 'UNREAD' ? '#4f46e5' : 'transparent' }} />
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a', margin: 0 }}>{notif.title}</h4>
                  <p style={{ fontSize: '0.875rem', color: '#475569', margin: '4px 0 0 0' }}>{notif.body}</p>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '8px 0 0 0' }}>
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
