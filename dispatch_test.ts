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

  console.log("Done");
  process.exit(0);
}

main().catch(console.error);
