import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryInvitations, deliveryAssignments, auditLogs, notifications, deliveryPartners } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { sendEmail } from '@/lib/emailService';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.assign'] }, async (tx, claims) => {
    try {
      const orderId = parseInt((await params).id, 10);
      const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
        ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
        : claims.tenantId) as number;

      if (isNaN(orderId)) {
        return NextResponse.json({ error: 'Invalid delivery order ID' }, { status: 400 });
      }

      // We need to fetch the delivery order to check if it has a temporaryWinnerId
      const [order] = await tx
        .select()
        .from(deliveryOrders)
        .where(
          and(
            eq(deliveryOrders.id, orderId),
            eq(deliveryOrders.tenantId, tenantIdToUse)
          )
        );

      if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      if (order.status !== 'WAITING_APPROVAL' || !order.temporaryWinnerId) {
        return NextResponse.json({ error: 'Order is not waiting for partner approval' }, { status: 400 });
      }

      // Update the order to DISPATCHED
      const [updatedOrder] = await tx
        .update(deliveryOrders)
        .set({
          status: 'DISPATCHED',
          approvedAt: new Date()
        })
        .where(eq(deliveryOrders.id, orderId))
        .returning();

      // Update the invitation to ASSIGNED
      await tx
        .update(deliveryInvitations)
        .set({ status: 'ASSIGNED' })
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.deliveryPartnerId, order.temporaryWinnerId)
          )
        );

      // Create the delivery assignment record
      const [assignment] = await tx
        .insert(deliveryAssignments)
        .values({
          tenantId: tenantIdToUse,
          deliveryOrderId: orderId,
          deliveryPartnerId: order.temporaryWinnerId,
          driverName: 'Assigned Partner Driver', 
          vehicleDetails: 'Partner Vehicle',
          status: 'ASSIGNED'
        })
        .returning();

      // Audit Log
      await tx.insert(auditLogs).values({
        tenantId: tenantIdToUse,
        actorType: 'USER',
        actorId: claims.userId as number,
        action: 'PARTNER_APPROVED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: `Tenant approved partner ID ${order.temporaryWinnerId} for the delivery request.`
      });

      // Send Email to Partner
      try {
        const [partner] = await tx.select().from(deliveryPartners).where(eq(deliveryPartners.id, order.temporaryWinnerId));
        if (partner && partner.email) {
          const { partnerApprovalTemplate } = await import('@/lib/emailTemplates');
          const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/partner/orders`;
          const template = partnerApprovalTemplate({
            orderId,
            partnerName: partner.companyName || partner.contactPerson || 'Delivery Partner',
            dashboardUrl,
          });

          await sendEmail({
            to: partner.email,
            subject: `🎉 Approved! Assigned to ORD-${String(orderId).padStart(5, '0')}`,
            html: template.html,
            text: template.text,
          });

          const bodyStr = await buildStandardNotificationBody('Assignment Confirmed', {
            orderId: order.id,
            status: 'ASSIGNED',
            reason: 'You have been selected as the Delivery Partner.'
          });

          await tx.insert(notifications).values({
            tenantId: tenantIdToUse,
            deliveryOrderId: order.id,
            senderId: claims.userId as number,
            receiverId: partner.id,
            receiverRole: 'DELIVERY_PARTNER',
            recipientEmail: partner.email,
            notificationType: 'order_accepted',
            title: 'Assignment Confirmed',
            body: bodyStr,
            actionUrl: `/partner/orders/${order.id}`,
            status: 'UNREAD',
          });
        }
      } catch (e) {
        console.error('Failed to send approval email to partner:', e);
      }

      return NextResponse.json({ success: true, message: 'Partner approved successfully.', assignment });

    } catch (error) {
      console.error('Error approving partner:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
