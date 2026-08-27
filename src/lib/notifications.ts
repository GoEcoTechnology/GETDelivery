import { db } from '@/db';
import { deviceTokens, notificationQueue } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { queueFcm } from '@/lib/queues';

type SendPushOptions = {
  userId?: number;
  partnerId?: number;
  title: string;
  body: string;
  data?: Record<string, string>;
  tenantId?: number | null;
  deliveryOrderId?: number | null;
};

export async function sendPushNotification({ 
  userId, 
  partnerId, 
  title, 
  body, 
  data,
  tenantId,
  deliveryOrderId
}: SendPushOptions) {
  if (!userId && !partnerId) {
    console.error("Must provide userId or partnerId to send push notification.");
    return;
  }

  try {
    // 1. Fetch all tokens for the given user/partner
    let query = db.select({ token: deviceTokens.fcmToken }).from(deviceTokens);
    
    if (userId) {
      query = query.where(and(
        eq(deviceTokens.userId, userId),
        eq(deviceTokens.userRole, 'USER') // Or the correct role for tenant
      )) as any;
    } else if (partnerId) {
      query = query.where(and(
        eq(deviceTokens.userId, partnerId),
        eq(deviceTokens.userRole, 'DELIVERY_PARTNER')
      )) as any;
    }

    const tokens = await query;
    if (tokens.length === 0) {
      console.log(`No device tokens found for ${userId ? `user ${userId}` : `partner ${partnerId}`}. Skipping push.`);
      return;
    }

    const tokenStrings = tokens.map(t => t.token);

    // 2. Prepare the FCM payload
    const payload = {
      title,
      body,
      data: data || {},
    };

    // 3. Queue the pushes
    for (const token of tokenStrings) {
      // Create a DB record for tracking (optional, but good practice since they have notificationQueue)
      const [queuedNotif] = await db.insert(notificationQueue).values({
        tenantId: tenantId || null,
        deliveryOrderId: deliveryOrderId || null,
        recipientType: partnerId ? 'DELIVERY_PARTNER' : 'USER',
        recipientId: partnerId || userId!,
        channel: 'FCM',
        status: 'PENDING',
      }).returning();

      if (queuedNotif) {
        await queueFcm(queuedNotif.id, token, payload);
      }
    }
    
    console.log(`Queued push notifications to ${tokenStrings.length} device(s).`);

  } catch (error) {
    console.error('Error queuing push notification:', error);
  }
}
