import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryPartners, deliveryInvitations, smsQueue, notifications, deviceTokens } from '@/db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { queueSms } from '@/lib/queues';
import crypto from 'crypto';
import { hashPassword } from '@/lib/password';
import { messaging } from '@/lib/firebase-admin';

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
        companyName: deliveryPartners.companyName
      })
      .from(deliveryPartners)
      .where(or(eq(deliveryPartners.status, 'ACTIVE'), eq(deliveryPartners.status, 'AVAILABLE')));
      
    if (eligiblePartners.length === 0) {
      return NextResponse.json({ error: 'No active delivery partners available' }, { status: 400 });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour
    
    const partnerIds = eligiblePartners.map(p => p.id);

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

      const newNotifsToInsert: any[] = [];
      const smsQueueToInsert: any[] = [];
      
      const messageTitle = 'New Delivery Request';
      const messageBody = `New order ready for pickup.\nOrder #SO-000${order.id}\nCustomer: ${order.customerName}\nPickup: ${order.pickupAddress}\nDropoff: ${order.dropoffAddress}\nTap to view details.`;

      eligiblePartners.forEach((partner: any, i: number) => {
        const fullToken = `${insertedInvitations[i].id}_${tokens[i]}`;
        const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${fullToken}`;
        const message = `NEW DELIVERY OPPORTUNITY: You have a delivery request from GET Delivery. Accept here: ${inviteLink}`;
        
        // Unified Push Notifications
        newNotifsToInsert.push({
          tenantId: tenantIdToUse,
          deliveryOrderId: order.id,
          senderId: claims.userId || null,
          receiverId: partner.id,
          receiverRole: 'DELIVERY_PARTNER',
          notificationType: 'new_delivery_request',
          title: messageTitle,
          body: messageBody,
          actionUrl: `/partner/orders/${order.id}`,
          status: 'UNREAD'
        });

        // SMS fallback logic 
        smsQueueToInsert.push({
          tenantId: tenantIdToUse,
          deliveryOrderId: order.id,
          recipientMobile: partner.mobileNumber,
          message,
          status: 'PENDING',
        });
      });

      const promises = [];

      // Insert unified notifications
      if (newNotifsToInsert.length > 0) {
        promises.push(innerTx.insert(notifications).values(newNotifsToInsert));
      }

      if (smsQueueToInsert.length > 0) {
        const insertedSms = await innerTx.insert(smsQueue).values(smsQueueToInsert).returning();
        promises.push(
          ...insertedSms.map((smsJob: any) => queueSms(smsJob.id, smsJob.recipientMobile, smsJob.message))
        );
      }

      await Promise.all(promises);
    });

    // Send Real Push Notifications directly via Firebase Admin SDK (outside of DB transaction so it doesn't block DB locks)
    if (messaging) {
      try {
        // Fetch valid tokens for these partners
        const tokens = await tx
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
          const messageTitle = 'New Delivery Request';
          const messageBody = `New order ready for pickup.\nOrder #SO-000${order.id}\nCustomer: ${order.customerName}\nTap to view details.`;
          
          await messaging.sendEachForMulticast({
            tokens: fcmTokens,
            notification: {
              title: messageTitle,
              body: messageBody,
            },
            data: {
              url: `/partner/orders/${order.id}`,
              action: 'view_order',
              order_id: order.id.toString(),
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
              }
            },
            webpush: {
              headers: {
                Urgency: 'high'
              }
            }
          });
        }
      } catch (fcmError) {
        console.error('Failed to send FCM multicast:', fcmError);
      }
    }

    return NextResponse.json({ success: true, message: `Dispatched to ${eligiblePartners.length} partners` });
  });
}
