import { NextResponse } from 'next/server';
import { deliveryOrders, deliveryItems, quotaAccumulations } from '@/db/schema';
import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, id),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== 'DRAFT') return NextResponse.json({ error: 'Only DRAFT orders can be marked as ready' }, { status: 400 });

    const items = await tx
      .select()
      .from(deliveryItems)
      .where(eq(deliveryItems.deliveryOrderId, id));

    if (items.length === 0) {
      return NextResponse.json({ error: 'No delivery items found for this order' }, { status: 400 });
    }

    const accumulations = await tx
      .select({
        productId: quotaAccumulations.productId,
        finalizedQty: drizzleSql<number>`COALESCE(SUM(${quotaAccumulations.quantityAdded}), 0)::int`,
      })
      .from(quotaAccumulations)
      .where(eq(quotaAccumulations.sourceOrderId, id))
      .groupBy(quotaAccumulations.productId);

    const finalizedMap = new Map<number, number>();
    for (const row of accumulations) {
      finalizedMap.set(row.productId, Number(row.finalizedQty || 0));
    }

    const itemsToFinalize = items.map((item: { productId: number; quantity: number; [key: string]: any }) => ({
      ...item,
      quantity: finalizedMap.get(item.productId) ?? item.quantity,
    }));

    const finalizedTotal = itemsToFinalize.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);

    for (const item of itemsToFinalize) {
      await tx
        .update(deliveryItems)
        .set({ quantity: item.quantity })
        .where(eq(deliveryItems.id, item.id));
    }

    await tx
      .update(deliveryOrders)
      .set({ currentOrdersCount: finalizedTotal })
      .where(eq(deliveryOrders.id, id));

    const [updated] = await tx
      .update(deliveryOrders)
      .set({ status: 'READY_FOR_DISPATCH' })
      .where(eq(deliveryOrders.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  });
}
