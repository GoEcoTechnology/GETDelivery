import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryInvitations, auditLogs, partnerNotifications, tenantNotifications } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

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

      // Notify the Tenant that a partner has accepted
      await tx.insert(tenantNotifications).values({
        tenantId: updatedOrder.tenantId,
        deliveryOrderId: orderId,
        title: 'Partner Accepted Delivery',
        body: `A delivery partner has accepted order #${orderId}. Please review and approve.`
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

      return NextResponse.json({ success: true, message: 'Delivery request accepted! Awaiting tenant approval.' });

    } catch (error) {
      console.error('Error accepting delivery:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
