import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, auditLogs, tenantNotifications, notifications, deviceTokens, deliveryPartners } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
      const { declineReason } = await request.json();

      if (isNaN(orderId)) {
        return NextResponse.json({ error: 'Invalid delivery order ID' }, { status: 400 });
      }

      // Mark the invitation as DECLINED using admin connection to bypass RLS
      const [updatedInvitation] = await db
        .update(deliveryInvitations)
        .set({
          status: 'DECLINED',
          declineReason: declineReason || 'Other',
          respondedAt: new Date()
        })
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.deliveryPartnerId, partnerId),
            eq(deliveryInvitations.status, 'PENDING') // Only if it's currently pending
          )
        )
        .returning();

      if (!updatedInvitation) {
        return NextResponse.json({ error: 'Cannot decline this request. It may have expired or you already responded.' }, { status: 400 });
      }

      // Check if there are any pending invitations left for this order
      const pendingInvitations = await db
        .select()
        .from(deliveryInvitations)
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.status, 'PENDING')
          )
        );

      if (pendingInvitations.length === 0) {
        // If no pending invitations remain, revert the order status to READY_FOR_DISPATCH
        await db
          .update(deliveryOrders)
          .set({ status: 'READY_FOR_DISPATCH' })
          .where(eq(deliveryOrders.id, orderId));
      }

      const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
      const partnerName = partner?.companyName || partner?.contactPerson || 'A delivery partner';

      const messageTitle = 'Delivery Request Declined';
      const messageBody = `${partnerName} declined your delivery request.\nReason: ${declineReason || 'Not specified'}`;

      // Insert Unified Notification
      await db.insert(notifications).values({
        tenantId: updatedInvitation.tenantId,
        deliveryOrderId: orderId,
        senderId: partnerId,
        receiverId: 0, // 0 for broadcast to tenant
        receiverRole: 'PLATFORM_OWNER',
        notificationType: 'order_declined',
        title: messageTitle,
        body: messageBody,
        actionUrl: `/admin/deliveries/${orderId}`,
        status: 'UNREAD'
      });

      // Insert Legacy Notification
      await db.insert(tenantNotifications).values({
        tenantId: updatedInvitation.tenantId,
        deliveryOrderId: orderId,
        title: messageTitle,
        body: messageBody
      });

      // Audit log
      await db.insert(auditLogs).values({
        tenantId: updatedInvitation.tenantId,
        actorType: 'PARTNER',
        actorId: partnerId,
        action: 'DELIVERY_REQUEST_DECLINED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: `Partner declined the request. Reason: ${declineReason || 'Not specified'}`
      });

      // Send Push Notification
      if (messaging) {
        try {
          const tenantTokens = await db
            .select({ fcmToken: deviceTokens.fcmToken })
            .from(deviceTokens)
            .where(
              and(
                eq(deviceTokens.tenantId, updatedInvitation.tenantId),
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
          console.error('Failed to send FCM to tenant on decline:', fcmError);
        }
      }

      return NextResponse.json({ success: true, message: 'Delivery request declined.' });

    } catch (error) {
      console.error('Error declining delivery:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
