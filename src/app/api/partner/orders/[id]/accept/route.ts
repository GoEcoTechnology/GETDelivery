import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryInvitations, auditLogs, notifications, deliveryPartners } from '@/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { sendEmail } from '@/lib/emailService';
import { users } from '@/db/schema';
import { 
  sendPartnerAcceptedNotification, 
  sendDeliveryNoLongerAvailableNotification 
} from '@/lib/emailWorkflowHelper';

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
          status: 'ASSIGNED',
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

      // Mark all other pending invitations as EXPIRED
      await db
        .update(deliveryInvitations)
        .set({
          status: 'EXPIRED',
          respondedAt: new Date()
        })
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.status, 'PENDING')
          )
        );

      const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
      const partnerName = partner?.companyName || partner?.contactPerson || 'A delivery partner';

      const messageTitle = 'Your order has been accepted!';
      const messageBody = `Delivery Partner ${partnerName} accepted your delivery request.\nOrder #SO-000${orderId}\nTap to track your delivery.`;

      // Create in-app notification
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

      // Audit log
      await db.insert(auditLogs).values({
        tenantId: updatedOrder.tenantId,
        actorType: 'PARTNER',
        actorId: partnerId,
        action: 'DELIVERY_REQUEST_ACCEPTED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: 'Partner accepted the delivery request and was assigned immediately.'
      });

      // Send emails asynchronously (fire-and-forget)
      const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin/deliveries/${orderId}`;
      
      // Send acceptance email to tenant users
      sendPartnerAcceptedNotification(
        updatedOrder.tenantId,
        orderId,
        partnerName,
        partner?.mobileNumber,
        updatedOrder.pickupAddress,
        undefined,
        dashboardUrl,
        orderId
      ).catch(err => {
        console.error('Failed to send partner accepted notification:', err.message);
      });

      // Send "no longer available" emails to remaining partners
      const remainingInvitations = await db
        .select()
        .from(deliveryInvitations)
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.status, 'EXPIRED')
          )
        );

      if (remainingInvitations.length > 0) {
        const remainingPartnerIds = remainingInvitations.map(inv => inv.deliveryPartnerId);
        const remainingPartners = await db
          .select()
          .from(deliveryPartners)
          .where(inArray(deliveryPartners.id, remainingPartnerIds));

        sendDeliveryNoLongerAvailableNotification(
          orderId,
          partnerName,
          dashboardUrl,
          remainingPartners
        ).catch(err => {
          console.error('Failed to send delivery expired notification:', err.message);
        });
      }

      return NextResponse.json({ success: true, message: 'Delivery request accepted and assigned successfully.' });
  });
}
