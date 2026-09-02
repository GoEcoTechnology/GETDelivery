import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryInvitations, deliveryAssignments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { revertOrderStock } from '@/lib/inventory-helper';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['delivery.cancel'] }, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid Delivery ID' }, { status: 400 });

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;

    // 1. Find the order
    let condition = eq(deliveryOrders.id, id);
    if (tenantIdToUse) {
      condition = and(condition, eq(deliveryOrders.tenantId, tenantIdToUse as number)) as any;
    }

    const [order] = await tx.select().from(deliveryOrders).where(condition);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (['DELIVERED', 'CANCELLED'].includes(order.status)) {
      return NextResponse.json({ error: 'Order cannot be cancelled in its current state' }, { status: 400 });
    }

    // 2. Update order status
    await tx.update(deliveryOrders)
      .set({ status: 'CANCELLED' })
      .where(eq(deliveryOrders.id, id));

    // 3. Cancel pending invitations
    await tx.update(deliveryInvitations)
      .set({ status: 'CANCELLED' })
      .where(and(eq(deliveryInvitations.deliveryOrderId, id), eq(deliveryInvitations.status, 'PENDING')));

    // 4. If assigned, update assignment
    await tx.update(deliveryAssignments)
      .set({ status: 'CANCELLED' })
      .where(and(eq(deliveryAssignments.deliveryOrderId, id)));

    // 5. Revert stock if it was already deducted
    const statesWithStockDeducted = ['DISPATCHED', 'WAITING_APPROVAL', 'ASSIGNED', 'IN_TRANSIT'];
    if (statesWithStockDeducted.includes(order.status)) {
      await revertOrderStock(tx, tenantIdToUse as number, order.id, claims.userId as number);
    }

    return NextResponse.json({ success: true });
  });
}
