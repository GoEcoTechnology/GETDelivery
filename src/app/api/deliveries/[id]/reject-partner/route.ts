import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryInvitations, auditLogs } from '@/db/schema';
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

      // Fetch the order
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

      const rejectedPartnerId = order.temporaryWinnerId;

      // Reset the order back to DISPATCHED and nullify the temporaryWinnerId
      await tx
        .update(deliveryOrders)
        .set({
          status: 'DISPATCHED',
          temporaryWinnerId: null
        })
        .where(eq(deliveryOrders.id, orderId));

      // Mark the rejected partner's invitation as DECLINED (or REJECTED)
      await tx
        .update(deliveryInvitations)
        .set({ 
          status: 'DECLINED',
          declineReason: 'Rejected by Tenant'
        })
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.deliveryPartnerId, rejectedPartnerId)
          )
        );

      // Audit Log
      await tx.insert(auditLogs).values({
        tenantId: tenantIdToUse,
        actorType: 'USER',
        actorId: claims.userId as number,
        action: 'PARTNER_REJECTED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: `Tenant rejected partner ID ${rejectedPartnerId} for the delivery request. The request is now open again.`
      });

      return NextResponse.json({ success: true, message: 'Partner rejected. Request is open again.' });

    } catch (error) {
      console.error('Error rejecting partner:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
