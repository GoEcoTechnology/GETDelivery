import { db } from '@/db';
import { deviceTokens, notificationQueue } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { messaging } from '@/lib/firebase-admin';

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
      data: {
        ...data,
        action: data?.action || 'view',
        action_url: data?.action_url || data?.url || '/'
      },
    };

    // 3. Prepare Notification Queue Record
    const [queuedNotif] = await db.insert(notificationQueue).values({
      tenantId: tenantId || null,
      deliveryOrderId: deliveryOrderId || null,
      recipientType: partnerId ? 'DELIVERY_PARTNER' : 'USER',
      recipientId: partnerId || userId!,
      channel: 'FCM',
      status: 'PENDING',
    }).returning();

    if (!messaging) {
      console.warn('Firebase Admin SDK not initialized. Cannot send push notification.');
      await db.update(notificationQueue).set({ status: 'FAILED' }).where(eq(notificationQueue.id, queuedNotif.id));
      return;
    }

    // 4. Send via Firebase Admin inline
    const fcmPayload = {
      tokens: tokenStrings,
      notification: {
        title: title,
        body: body,
      },
      data: payload.data,
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        fcmOptions: {
          link: payload.data.action_url
        },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          vibrate: [200, 100, 200, 100, 200]
        }
      }
    };

    const response = await messaging.sendEachForMulticast(fcmPayload);
    
    console.log(`Sent push notification. Success: ${response.successCount}, Failed: ${response.failureCount}`);

    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          if (resp.error.code === 'messaging/invalid-registration-token' || resp.error.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokenStrings[idx]);
          }
        }
      });
      if (invalidTokens.length > 0) {
        await db.delete(deviceTokens).where(inArray(deviceTokens.fcmToken, invalidTokens));
      }
    }

    // 5. Update Audit Queue Status
    await db.update(notificationQueue)
      .set({ status: response.successCount > 0 ? 'COMPLETED' : 'FAILED' })
      .where(eq(notificationQueue.id, queuedNotif.id));

  } catch (error) {
    console.error('Error sending push notification inline:', error);
  }
}

