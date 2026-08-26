import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryInvitations, auditLogs, partnerNotifications, tenantNotifications, notifications, deviceTokens, deliveryPartners } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { messaging } from '@/lib/firebase-admin';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['partner.access'] }, async (tx, claims) => {
    try {
      const orderId = parseInt((await params).id, 10);
      const partnerId = claims.partnerId as number;

      if (isNaN(orderId)) {
        return NextResponse.json({ error: 'Invalid delivery order ID' }, { status: 400 });
      }

      // Attempt to atomically update the deliveryOrder
      const [updatedOrder] = await tx
        .update(deliveryOrders)
        .set({
          status: 'WAITING_APPROVAL',
          temporaryWinnerId: partnerId
        })
        .where(
          and(
            eq(deliveryOrders.id, orderId),
            eq(deliveryOrders.status, 'DISPATCHED'), // Only update if it's currently DISPATCHED
            isNull(deliveryOrders.temporaryWinnerId)
          )
        )
        .returning();

      // If we didn't get an updated order back, it means someone else won or the order doesn't exist/isn't valid.
      if (!updatedOrder) {
        // Let's see if the order exists and has a winner
        const [existingOrder] = await tx.select().from(deliveryOrders).where(eq(deliveryOrders.id, orderId));
        if (existingOrder && existingOrder.temporaryWinnerId && existingOrder.temporaryWinnerId !== partnerId) {
           return NextResponse.json({ error: 'This delivery request has already been assigned to another partner.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Could not accept this delivery. It may have expired or already been processed.' }, { status: 400 });
      }

      // Mark the invitation for this partner as TEMPORARY_WINNER
      await tx
        .update(deliveryInvitations)
        .set({
          status: 'TEMPORARY_WINNER',
          respondedAt: new Date()
        })
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.deliveryPartnerId, partnerId)
          )
        );

      const [partner] = await tx.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
      const partnerName = partner?.companyName || partner?.contactPerson || 'A delivery partner';

      const messageTitle = 'Your order has been accepted!';
      const messageBody = `Delivery Partner ${partnerName} accepted your delivery request.\nOrder #SO-000${orderId}\nTap to track your delivery.`;

      // Unified Notifications
      // Since it's going to the tenant, we might broadcast it to all platform owners/admins of that tenant.
      // But for the database record, we use receiverRole = 'PLATFORM_OWNER' or 'TENANT_ADMIN' and receiverId can be 0 or specific users.
      // To keep it simple, we insert a notification for receiverRole = 'PLATFORM_OWNER' with tenantId.
      await tx.insert(notifications).values({
        tenantId: updatedOrder.tenantId,
        deliveryOrderId: orderId,
        senderId: partnerId,
        receiverId: 0, // 0 for broadcast to tenant
        receiverRole: 'PLATFORM_OWNER',
        notificationType: 'order_accepted',
        title: messageTitle,
        body: messageBody,
        actionUrl: `/admin/deliveries/${orderId}`,
        status: 'UNREAD'
      });

      // Legacy fallback
      await tx.insert(tenantNotifications).values({
        tenantId: updatedOrder.tenantId,
        deliveryOrderId: orderId,
        title: messageTitle,
        body: messageBody
      });

      // Audit log
      await tx.insert(auditLogs).values({
        tenantId: updatedOrder.tenantId,
        actorType: 'PARTNER',
        actorId: partnerId,
        action: 'DELIVERY_REQUEST_ACCEPTED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: 'Partner accepted the delivery request, awaiting tenant approval.'
      });

      // Send real Push Notification to Tenant/Platform Owners
      if (messaging) {
        try {
          const tenantTokens = await tx
            .select({ fcmToken: deviceTokens.fcmToken })
            .from(deviceTokens)
            .where(
              and(
                eq(deviceTokens.tenantId, updatedOrder.tenantId),
                eq(deviceTokens.userRole, 'PLATFORM_OWNER')
              )
            );

          const fcmTokens = tenantTokens.map((t: { fcmToken: string }) => t.fcmToken);

          if (fcmTokens.length > 0) {
            await messaging.sendEachForMulticast({
              tokens: fcmTokens,
              notification: {
                title: messageTitle,
                body: messageBody,
              },
              data: {
                url: `/admin/deliveries/${orderId}`,
                action: 'view_order',
                order_id: orderId.toString(),
              },
            });
          }
        } catch (fcmError) {
          console.error('Failed to send FCM to tenant on accept:', fcmError);
        }
      }

      return NextResponse.json({ success: true, message: 'Delivery request accepted! Awaiting tenant approval.' });

    } catch (error) {
      console.error('Error accepting delivery:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
