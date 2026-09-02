import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryBatches } from '@/db/schema';
import { eq, and, asc, isNull, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.create'] }, async (tx, claims) => {
    const body = await request.json();
    const { maxOrders = 10 } = body;

    const tenantIdToUse = claims.tenantId as number;

    // 1. Find oldest READY_FOR_DISPATCH orders without a batch
    const eligibleOrders = await tx
      .select()
      .from(deliveryOrders)
      .where(
        and(
          eq(deliveryOrders.tenantId, tenantIdToUse),
          eq(deliveryOrders.status, 'READY_FOR_DISPATCH'),
          isNull(deliveryOrders.batchId)
        )
      )
      .orderBy(asc(deliveryOrders.createdAt))
      .limit(maxOrders);

    if (eligibleOrders.length === 0) {
      return NextResponse.json({ error: 'No unbatched READY_FOR_DISPATCH orders available' }, { status: 400 });
    }

    // 2. Create the batch
    const [batch] = await tx.insert(deliveryBatches).values({
      tenantId: tenantIdToUse,
      maxOrders,
      status: 'ACTIVE'
    }).returning();

    // 3. Assign orders to the batch
    const orderIds = eligibleOrders.map((o: any) => o.id);
    await tx.update(deliveryOrders)
      .set({ batchId: batch.id })
      .where(inArray(deliveryOrders.id, orderIds));

    return NextResponse.json({ success: true, batch, assignedCount: orderIds.length });
  });
}
