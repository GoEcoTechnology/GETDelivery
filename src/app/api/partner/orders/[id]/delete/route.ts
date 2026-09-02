import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryInvitations, deliveryAssignments, deliveryItems, quotaAccumulations, notifications, auditLogs, productQuotas } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { revertOrderStock } from '@/lib/inventory-helper';

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

    const [invitation] = await db
      .select()
      .from(deliveryInvitations)
      .where(and(eq(deliveryInvitations.deliveryOrderId, orderId), eq(deliveryInvitations.deliveryPartnerId, partnerId)));

    if (!invitation) {
      return NextResponse.json({ error: 'Order not found or you do not have access to delete it.' }, { status: 404 });
    }

    const [order] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, orderId));
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isStockReversible = ['DISPATCHED', 'WAITING_APPROVAL', 'ASSIGNED', 'IN_TRANSIT'].includes(order.status);
    if (isStockReversible) {
      await revertOrderStock(tx, invitation.tenantId, order.id, claims.partnerId as number);
    }

    const accumulations = await db.select().from(quotaAccumulations).where(eq(quotaAccumulations.sourceOrderId, order.id));
    for (const accum of accumulations) {
      const [quota] = await db.select().from(productQuotas).where(eq(productQuotas.productId, accum.productId));
      if (quota) {
        const newAccumulated = Math.max(0, quota.accumulatedQuantity - accum.quantityAdded);
        const newStatus = newAccumulated >= quota.targetQuantity ? 'REACHED' : 'IN_PROGRESS';
        await db.update(productQuotas).set({ accumulatedQuantity: newAccumulated, status: newStatus }).where(eq(productQuotas.id, quota.id));
      }
    }

    await db.delete(quotaAccumulations).where(eq(quotaAccumulations.sourceOrderId, order.id));
    await db.delete(deliveryAssignments).where(eq(deliveryAssignments.deliveryOrderId, order.id));
    await db.delete(deliveryInvitations).where(eq(deliveryInvitations.deliveryOrderId, order.id));
    await db.delete(notifications).where(eq(notifications.deliveryOrderId, order.id));
    await db.delete(auditLogs).where(and(eq(auditLogs.entityType, 'DELIVERY_ORDER'), eq(auditLogs.entityId, order.id)));
    await db.delete(deliveryItems).where(eq(deliveryItems.deliveryOrderId, order.id));
    await db.delete(deliveryOrders).where(eq(deliveryOrders.id, order.id));

    return NextResponse.json({ success: true, message: 'Order deleted successfully.' });
  });
}
