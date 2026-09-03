import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, auditLogs, notifications, deliveryPartners, tenants } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';
import { sendEmail } from '@/lib/emailService';
import * as emailTemplates from '@/lib/emailTemplates';
import { sendEmailToTenantUsers } from '@/lib/emailWorkflowHelper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['partner.access'] }, async (tx, claims) => {
    try {
      const orderId = parseInt((await params).id, 10);
      const partnerId = claims.partnerId as number;
      const { cancelReason } = await request.json();

      if (isNaN(orderId)) {
        return NextResponse.json({ error: 'Invalid delivery order ID' }, { status: 400 });
      }

      // Check if order is assigned to this partner
      const [order] = await db.select().from(deliveryOrders).where(
        and(
          eq(deliveryOrders.id, orderId),
          eq(deliveryOrders.temporaryWinnerId, partnerId)
        )
      );

      if (!order) {
        return NextResponse.json({ error: 'Order not found or not assigned to you.' }, { status: 404 });
      }

      // 1. Update order status back to DISPATCHED
      await db.update(deliveryOrders)
        .set({ status: 'DISPATCHED', temporaryWinnerId: null })
        .where(eq(deliveryOrders.id, orderId));

      // 2. Mark this partner's invitation as CANCELLED
      await db.update(deliveryInvitations)
        .set({ status: 'CANCELLED', declineReason: cancelReason || 'Cancelled by partner', respondedAt: new Date() })
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.deliveryPartnerId, partnerId)
          )
        );

      // 3. Reactivate EXPIRED invitations for other partners
      await db.update(deliveryInvitations)
        .set({ status: 'PENDING', respondedAt: null })
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.status, 'EXPIRED'),
            ne(deliveryInvitations.deliveryPartnerId, partnerId)
          )
        );

      const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
      const partnerName = partner?.companyName || partner?.contactPerson || 'A delivery partner';

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId));
      const businessName = tenant?.name || 'Business Owner';

      // 4. Notify Business Owner
      const tenantMsgTitle = 'Assigned Delivery Cancelled';
      const tenantMsgBody = await buildStandardNotificationBody(tenantMsgTitle, {
        orderId: orderId,
        status: 'CANCELLED',
        reason: cancelReason || 'None provided'
      });
      
      await db.insert(notifications).values({
        tenantId: order.tenantId,
        deliveryOrderId: orderId,
        senderId: partnerId,
        receiverId: 0,
        receiverRole: 'PLATFORM_OWNER',
        notificationType: 'order_declined',
        title: tenantMsgTitle,
        body: tenantMsgBody,
        actionUrl: `/admin/deliveries/${orderId}`,
        status: 'UNREAD'
      });

      // Send email to business owner and employees via the workflow helper
      await sendEmailToTenantUsers(
        order.tenantId,
        tenantMsgTitle,
        emailTemplates.orderDeclinedTemplate({
          businessName,
          partnerName: partnerName,
          orderId: orderId,
          reason: cancelReason || 'None provided',
          dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://getdelivery.ph'}/admin/deliveries/${orderId}`,
        })
      ).catch(err => console.error('Failed to send cancellation email to owner:', err));

      // 5. Notify Eligible Partners
      const eligibleInvitations = await db.select().from(deliveryInvitations)
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.status, 'PENDING')
          )
        );

      for (const inv of eligibleInvitations) {
        const pBody = await buildStandardNotificationBody('Order Available Again', {
          orderId: orderId,
          status: 'PENDING',
          reason: 'Order was cancelled by the previous Delivery Partner.'
        });

        await db.insert(notifications).values({
          tenantId: order.tenantId,
          deliveryOrderId: orderId,
          senderId: 0,
          receiverId: inv.deliveryPartnerId,
          receiverRole: 'DELIVERY_PARTNER',
          notificationType: 'new_delivery_request',
          title: 'Order Available Again',
          body: pBody,
          actionUrl: `/partner/orders/${orderId}`,
          status: 'UNREAD'
        });

        const [dp] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, inv.deliveryPartnerId));
        if (dp && dp.email) {
          let formattedDate = 'Not specified';
          if (order.deliveryDate) {
            formattedDate = new Date(order.deliveryDate).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            });
          }

          await sendEmail({
            to: dp.email,
            subject: 'Order Available Again',
            html: `
              <h2 style="color:#0f172a; margin-bottom: 16px;">A delivery request is available again</h2>
              <p style="color:#334155; margin-bottom: 12px;">Order <strong>#${orderId}</strong> was cancelled by the previous Delivery Partner and is now available for acceptance.</p>
              <ul style="color:#334155; margin-bottom: 24px; padding-left: 20px;">
                <li style="margin-bottom: 8px;"><strong>Pickup:</strong> ${order.pickupAddress}</li>
                <li style="margin-bottom: 8px;"><strong>Destination:</strong> ${order.dropoffAddress}</li>
                <li style="margin-bottom: 8px;"><strong>Delivery Date:</strong> ${formattedDate}</li>
              </ul>
              <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://getdelivery.ph'}/partner/orders/${orderId}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:600;">View Order Details</a>
            `,
          }).catch(err => console.error('Failed to send availability email to partner:', err));
        }
      }

      // 6. Audit Log
      await db.insert(auditLogs).values({
        tenantId: order.tenantId,
        actorType: 'PARTNER',
        actorId: partnerId,
        action: 'DELIVERY_REQUEST_CANCELLED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: `Partner cancelled assignment. Reason: ${cancelReason || 'Not specified'}. Order reverted to DISPATCHED.`
      });

      return NextResponse.json({ success: true, message: 'Assignment cancelled successfully. Order is available again.' });
    } catch (error) {
      console.error('Error cancelling delivery assignment:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
