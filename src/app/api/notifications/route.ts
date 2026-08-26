import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notificationQueue, smsQueue } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.view'] }, async (tx, claims) => {
    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
    
    // Fetch both FCM and SMS queues
    let fcmQuery = tx.select({
      id: notificationQueue.id,
      recipientType: notificationQueue.recipientType,
      status: notificationQueue.status,
      createdAt: notificationQueue.createdAt,
    }).from(notificationQueue).orderBy(desc(notificationQueue.createdAt)).limit(50);
    let smsQuery = tx.select({
      id: smsQueue.id,
      recipientMobile: smsQueue.recipientMobile,
      status: smsQueue.status,
      createdAt: smsQueue.createdAt,
    }).from(smsQueue).orderBy(desc(smsQueue.createdAt)).limit(50);

    if (tenantIdToUse) {
      fcmQuery = fcmQuery.where(eq(notificationQueue.tenantId, tenantIdToUse as number));
      smsQuery = smsQuery.where(eq(smsQueue.tenantId, tenantIdToUse as number));
    }
    
    const [fcmLogs, smsLogs] = await Promise.all([fcmQuery, smsQuery]);
    
    return NextResponse.json({ 
      data: {
        fcm: fcmLogs,
        sms: smsLogs
      }
    });
  });
}
