import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, auditLogs, notifications, deliveryPartners } from '@/db/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { sendEmail } from '@/lib/emailService';
import { users } from '@/db/schema';
import { sendPartnerDeclinedNotification } from '@/lib/emailWorkflowHelper';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';

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
      const messageBody = await buildStandardNotificationBody(messageTitle, {
        orderId: orderId,
        status: 'DECLINED',
        reason: declineReason || 'Not specified'
      });

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

      // Send decline notification email to tenant users (fire-and-forget)
      const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin/deliveries/${orderId}`;
      sendPartnerDeclinedNotification(
        updatedInvitation.tenantId,
        orderId,
        partnerName,
        declineReason || 'Not specified',
        dashboardUrl,
        orderId
      ).catch(err => {
        console.error('Failed to send partner declined notification:', err.message);
      });

      // If there are still pending invitations, do not send "available" emails here
      // The order remains in READY_FOR_DISPATCH and awaits Business Owner to re-broadcast
      // if they want to retry with other partners

      return NextResponse.json({ success: true, message: 'Delivery request declined.' });

    } catch (error) {
      console.error('Error declining delivery:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
