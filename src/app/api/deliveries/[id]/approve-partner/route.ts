import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryInvitations, deliveryAssignments, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

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

      // Update the order to DISPATCHED (actually the next step is usually ASSIGNED, but wait, the prompt says:
      // "If Client Approves: Request becomes Assigned. Delivery status becomes Out for Delivery.")
      // Let's set it to 'DISPATCHED' or whatever the business logic is. Actually "Out for Delivery" usually maps to 'DISPATCHED' in our ENUM?
      // Wait, our ENUM is DRAFT, CONFIRMED, READY_FOR_DISPATCH, DISPATCHED, WAITING_APPROVAL, COMPLETED, CANCELLED.
      // We will set it to 'DISPATCHED'.
      
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

      // Create the delivery assignment record (this was previously done when they accepted the token)
      const [assignment] = await tx
        .insert(deliveryAssignments)
        .values({
          tenantId: tenantIdToUse,
          deliveryOrderId: orderId,
          deliveryPartnerId: order.temporaryWinnerId,
          driverName: 'Assigned Partner Driver', // They will update this later or we can fetch partner details
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

      return NextResponse.json({ success: true, message: 'Partner approved successfully.', assignment });

    } catch (error) {
      console.error('Error approving partner:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
