import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryInvitations, auditLogs, tenantNotifications, notifications, deviceTokens, deliveryPartners } from '@/db/schema';
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

      // Mark the invitation as DECLINED
      const [updatedInvitation] = await tx
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

      // Audit log
      await tx.insert(auditLogs).values({
        tenantId: updatedInvitation.tenantId,
        actorType: 'PARTNER',
        actorId: partnerId,
        action: 'DELIVERY_REQUEST_DECLINED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: `Partner declined the request. Reason: ${declineReason}`
      });

      const [partner] = await tx.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
      const partnerName = partner?.companyName || partner?.contactPerson || 'A delivery partner';

      const messageTitle = 'Delivery Partner unavailable';
      const messageBody = `Delivery Partner ${partnerName} declined request #${orderId}. Reason: ${declineReason || 'None provided'}`;

      // Unified Notifications for Platform Owner
      await tx.insert(notifications).values({
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

      // Notify the tenant (Legacy fallback - matching actual schema)
      await tx.insert(tenantNotifications).values({
        tenantId: updatedInvitation.tenantId,
        deliveryOrderId: orderId,
        title: messageTitle,
        body: messageBody
      });

      // Send real Push Notification to Tenant/Platform Owners
      if (messaging) {
        try {
          const tenantTokens = await tx
            .select({ fcmToken: deviceTokens.fcmToken })
            .from(deviceTokens)
            .where(
              and(
                eq(deviceTokens.tenantId, updatedInvitation.tenantId),
                eq(deviceTokens.userRole, 'PLATFORM_OWNER')
              )
            );

          const fcmTokens = tenantTokens.map(t => t.fcmToken);

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
