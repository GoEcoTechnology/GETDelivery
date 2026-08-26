import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryPartners, deliveryInvitations, smsQueue, notificationQueue, partnerNotifications } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { queueSms, queueFcm } from '@/lib/queues';
import crypto from 'crypto';
import { hashPassword } from '@/lib/password';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.dispatch'] }, async (tx, claims) => {
    const orderId = parseInt((await params).id, 10);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid delivery ID' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    // Fetch and validate the order
    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, orderId),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!order) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
    }

    if (order.status !== 'READY_FOR_DISPATCH' && order.status !== 'DRAFT') {
      return NextResponse.json({ error: `Cannot dispatch delivery in status: ${order.status}` }, { status: 400 });
    }

    // Find eligible ACTIVE delivery partners
    const eligiblePartners = await tx
      .select({ 
        id: deliveryPartners.id, 
        mobileNumber: deliveryPartners.mobileNumber,
        notificationToken: deliveryPartners.notificationToken 
      })
      .from(deliveryPartners)
      .where(or(eq(deliveryPartners.status, 'ACTIVE'), eq(deliveryPartners.status, 'AVAILABLE')));
      
    if (eligiblePartners.length === 0) {
      return NextResponse.json({ error: 'No active delivery partners available' }, { status: 400 });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Create invitations and queue SMS synchronously in the DB transaction
    await tx.transaction(async (innerTx: any) => {
      // 1. Update order status atomically
      await innerTx
        .update(deliveryOrders)
        .set({ status: 'DISPATCHED' })
        .where(eq(deliveryOrders.id, order.id));

      // 2. Generate Tokens and Hash
      const tokens = eligiblePartners.map(() => crypto.randomBytes(32).toString('hex'));
      const tokenHashes = await Promise.all(tokens.map((t: string) => hashPassword(t)));

      const invitationsToInsert = eligiblePartners.map((partner: any, i: number) => ({
        tenantId: tenantIdToUse,
        deliveryOrderId: order.id,
        deliveryPartnerId: partner.id,
        tokenHash: tokenHashes[i],
        status: 'PENDING',
        expiresAt
      }));

      const insertedInvitations = await innerTx
        .insert(deliveryInvitations)
        .values(invitationsToInsert)
        .returning();

      const fcmTokensToInsert: any[] = [];
      const smsQueueToInsert: any[] = [];
      const partnerNotifsToInsert: any[] = [];

      eligiblePartners.forEach((partner: any, i: number) => {
        const fullToken = `${insertedInvitations[i].id}_${tokens[i]}`;
        const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${fullToken}`;
        const message = `NEW DELIVERY OPPORTUNITY: You have a delivery request from GET Delivery. Accept here: ${inviteLink}`;
        
        const messageTitle = 'New Delivery Opportunity';
        const messageBody = 'You have a delivery request from GET Delivery. Tap to accept.';

        // Always add in-app notification for the partner portal
        partnerNotifsToInsert.push({
          tenantId: tenantIdToUse,
          deliveryPartnerId: partner.id,
          deliveryOrderId: order.id,
          title: messageTitle,
          body: messageBody
        });

        if (partner.notificationToken) {
          fcmTokensToInsert.push({
            tenantId: tenantIdToUse,
            deliveryOrderId: order.id,
            recipientType: 'DELIVERY_PARTNER',
            recipientId: partner.id,
            channel: 'FCM',
            status: 'PENDING',
          });
        } else {
          smsQueueToInsert.push({
            tenantId: tenantIdToUse,
            deliveryOrderId: order.id,
            recipientMobile: partner.mobileNumber,
            message,
            status: 'PENDING',
          });
        }
      });

      const promises = [];

      // Insert in-app notifications
      if (partnerNotifsToInsert.length > 0) {
        promises.push(innerTx.insert(partnerNotifications).values(partnerNotifsToInsert));
      }

      if (smsQueueToInsert.length > 0) {
        const insertedSms = await innerTx.insert(smsQueue).values(smsQueueToInsert).returning();
        promises.push(
          ...insertedSms.map((smsJob: any) => queueSms(smsJob.id, smsJob.recipientMobile, smsJob.message))
        );
      }

      if (fcmTokensToInsert.length > 0) {
        const insertedFcm = await innerTx.insert(notificationQueue).values(fcmTokensToInsert).returning();
        promises.push(
          ...insertedFcm.map((fcmJob: any) => {
            const partner = eligiblePartners.find((p: any) => p.id === fcmJob.recipientId);
            const partnerIndex = eligiblePartners.findIndex((p: any) => p.id === fcmJob.recipientId);
            const fullToken = `${insertedInvitations[partnerIndex].id}_${tokens[partnerIndex]}`;
            const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${fullToken}`;
            const partnerUrl = `/partner/orders/${order.id}`;
            const messageTitle = 'New Delivery Opportunity';
            const messageBody = 'You have a delivery request from GET Delivery. Tap to accept.';

            return queueFcm(fcmJob.id, partner.notificationToken, {
              title: messageTitle,
              body: messageBody,
              data: { inviteLink, url: partnerUrl }
            });
          })
        );
      }

      await Promise.all(promises);
    });

    return NextResponse.json({ success: true, message: `Dispatched to ${eligiblePartners.length} partners` });
  });
}

