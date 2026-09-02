import { NextResponse } from 'next/server';
import { deliveryOrders } from '@/db/schema';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.create'] }, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const quantity = parseInt(body.quantity, 10);

    if (isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 });
    }

    const tenantIdToUse = claims.tenantId as number;

    // 1. Find the master order (the one managing the quota)
    const [masterOrder] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, id),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!masterOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const remaining = masterOrder.quota - masterOrder.currentOrdersCount;
    if (quantity > remaining) {
      return NextResponse.json({ 
        error: `Cannot add ${quantity} orders. Remaining capacity is only ${remaining}.` 
      }, { status: 400 });
    }

    // Update master order's count
    const newCount = masterOrder.currentOrdersCount + quantity;
    const [updated] = await tx
      .update(deliveryOrders)
      .set({ currentOrdersCount: newCount })
      .where(eq(deliveryOrders.id, id))
      .returning();

    return NextResponse.json({ 
      success: true, 
      addedCount: quantity, 
      currentOrdersCount: updated.currentOrdersCount,
      remainingCapacity: updated.quota - updated.currentOrdersCount
    });
  });
}
