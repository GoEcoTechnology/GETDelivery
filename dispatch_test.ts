import 'dotenv/config';
import { db } from './src/db';
import { deliveryOrders, deliveryPartners, deliveryInvitations, partnerNotifications } from './src/db/schema';
import { eq, or } from 'drizzle-orm';
import crypto from 'crypto';
import { hashPassword } from './src/lib/password';

async function main() {
  const orderId = 3;
  const tenantIdToUse = 3;

  const [order] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, orderId));
  console.log("Order found:", order.status);

  const eligiblePartners = await db.select().from(deliveryPartners).where(or(eq(deliveryPartners.status, 'ACTIVE'), eq(deliveryPartners.status, 'AVAILABLE')));
  console.log("Eligible partners:", eligiblePartners.length);

  await db.transaction(async (tx) => {
    console.log("In tx");
    await tx.update(deliveryOrders).set({ status: 'DISPATCHED' }).where(eq(deliveryOrders.id, order.id));
    console.log("Order updated");

    const tokens = eligiblePartners.map(() => crypto.randomBytes(32).toString('hex'));
    const tokenHashes = await Promise.all(tokens.map((t) => hashPassword(t)));

    const invitationsToInsert = eligiblePartners.map((partner, i) => ({
      tenantId: tenantIdToUse,
      deliveryOrderId: order.id,
      deliveryPartnerId: partner.id,
      tokenHash: tokenHashes[i],
      status: 'PENDING' as any,
      expiresAt: new Date(Date.now() + 3600000)
    }));

    const insertedInvitations = await tx.insert(deliveryInvitations).values(invitationsToInsert).returning();
    console.log("Invitations inserted:", insertedInvitations.length);

    const partnerNotifsToInsert = eligiblePartners.map(partner => ({
      tenantId: tenantIdToUse,
      deliveryPartnerId: partner.id,
      deliveryOrderId: order.id,
      title: 'New Delivery Opportunity',
      body: 'You have a delivery request from GET Delivery. Tap to accept.'
    }));

    if (partnerNotifsToInsert.length > 0) {
      await tx.insert(partnerNotifications).values(partnerNotifsToInsert);
      console.log("Notifications inserted");
    }
  });

  // Send real Push Notification to Tenant/Platform Owners for testing
  const { messaging } = await import('./src/lib/firebase-admin');
  const { deviceTokens } = await import('./src/db/schema');
  const { inArray, and } = await import('drizzle-orm');
  
  if (messaging) {
    try {
      const partnerIds = eligiblePartners.map(p => p.id);
      const tokens = await db
        .select({ fcmToken: deviceTokens.fcmToken })
        .from(deviceTokens)
        .where(
          and(
            inArray(deviceTokens.userId, partnerIds),
            eq(deviceTokens.userRole, 'DELIVERY_PARTNER')
          )
        );

      const fcmTokens = tokens.map(t => t.fcmToken);

      if (fcmTokens.length > 0) {
        console.log(`Sending FCM to ${fcmTokens.length} tokens...`);
        const messageTitle = 'New Delivery Request';
        const messageBody = 'You have a delivery request from GET Delivery. Tap to accept.';
        
        await messaging.sendEachForMulticast({
          tokens: fcmTokens,
          data: {
            title: messageTitle,
            body: messageBody,
            url: `/partner/orders/${order.id}`,
            action: 'view_order',
            order_id: order.id.toString(),
          },
        });
        console.log("FCM Sent successfully.");
      } else {
        console.log("No FCM tokens found for partners.");
      }
    } catch (fcmError) {
      console.error('Failed to send FCM:', fcmError);
    }
  }

  console.log("Done");
  process.exit(0);
}

main().catch(console.error);
