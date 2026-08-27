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
      const orderId = parseInt((await params).id, 10);
      const partnerId = claims.partnerId as number;

      if (isNaN(orderId)) {
        return NextResponse.json({ error: 'Invalid delivery order ID' }, { status: 400 });
      }

      // Verify invitation first using admin DB connection
      const [invitation] = await db.select().from(deliveryInvitations).where(
        and(
          eq(deliveryInvitations.deliveryOrderId, orderId),
          eq(deliveryInvitations.deliveryPartnerId, partnerId),
          eq(deliveryInvitations.status, 'PENDING')
        )
      );

      if (!invitation) {
        // Find order to give better error message
        const [existingOrder] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, orderId));
        if (!existingOrder) {
          return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
        }
        if (existingOrder.temporaryWinnerId === partnerId) {
          return NextResponse.json({ success: true, message: 'You have already accepted this request.' });
        }
        return NextResponse.json({ 
          error: `Could not accept this delivery. It may have expired or been assigned to another partner.` 
        }, { status: 400 });
      }

      // Perform updates using admin connection to bypass RLS restrictions on deliveryOrders for partners
      const [updatedOrder] = await db
        .update(deliveryOrders)
        .set({
          status: 'WAITING_APPROVAL',
          temporaryWinnerId: partnerId
        })
        .where(
          and(
            eq(deliveryOrders.id, orderId),
            eq(deliveryOrders.status, 'DISPATCHED'),
            isNull(deliveryOrders.temporaryWinnerId)
          )
        )
        .returning();

      if (!updatedOrder) {
        return NextResponse.json({ error: 'Failed to accept. Order may no longer be available.' }, { status: 409 });
      }

      // Mark the invitation for this partner as TEMPORARY_WINNER
      await db
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

      const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
      const partnerName = partner?.companyName || partner?.contactPerson || 'A delivery partner';

      const messageTitle = 'Your order has been accepted!';
      const messageBody = `Delivery Partner ${partnerName} accepted your delivery request.\nOrder #SO-000${orderId}\nTap to track your delivery.`;

      // Unified Notifications
      // Since it's going to the tenant, we might broadcast it to all platform owners/admins of that tenant.
      // But for the database record, we use receiverRole = 'PLATFORM_OWNER' or 'TENANT_ADMIN' and receiverId can be 0 or specific users.
      // To keep it simple, we insert a notification for receiverRole = 'PLATFORM_OWNER' with tenantId.
      await db.insert(notifications).values({
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
      await db.insert(tenantNotifications).values({
        tenantId: updatedOrder.tenantId,
        deliveryOrderId: orderId,
        title: messageTitle,
        body: messageBody
      });

      // Audit log
      await db.insert(auditLogs).values({
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
          const tenantTokens = await db
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
              // Data-only payload forces the service worker to handle it explicitly in background
              data: {
                title: messageTitle,
                body: messageBody,
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
  });
}
