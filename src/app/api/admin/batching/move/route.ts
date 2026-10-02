import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryBatches, deliveryBatchItems, productSellingUnits } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);
    if (!claims || !claims.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const tenantId = claims.tenantId as number;

    const { orderId, targetBatchId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // Find the order
    const [order] = await db.select().from(deliveryOrders).where(and(eq(deliveryOrders.id, orderId), eq(deliveryOrders.tenantId, tenantId)));
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    const sourceBatchId = order.batchId;
    if (sourceBatchId === targetBatchId) {
      return NextResponse.json({ success: true, message: 'No change' });
    }

    // Start a manual transaction (or just sequence of updates)
    // 1. Remove from source batch
    if (sourceBatchId) {
      await db.delete(deliveryBatchItems)
        .where(and(
          eq(deliveryBatchItems.batchId, sourceBatchId),
          eq(deliveryBatchItems.customerOrderId, orderId)
        ));
        
      // Re-calculate source batch totals
      await recalculateBatch(sourceBatchId);
    }

    // 2. Add to target batch
    if (targetBatchId) {
      // Find the target batch to ensure it belongs to the same basis product? 
      // The business owner might force it. For now, trust the owner or check variant match.
      const [targetBatch] = await db.select().from(deliveryBatches).where(eq(deliveryBatches.id, targetBatchId));
      if (!targetBatch) {
        return NextResponse.json({ error: 'Target batch not found' }, { status: 404 });
      }

      // Calculate customer weight for this order (simplified to basisQuantity for now if exact weight is hard, but we can do a query)
      await db.insert(deliveryBatchItems).values({
        batchId: targetBatchId,
        customerOrderId: orderId,
        customerId: order.customerId as number,
        quantity: order.basisQuantity,
        customerWeight: '0' // Compute properly if needed
      });

      // Update target batch
      await recalculateBatch(targetBatchId);
    }

    // 3. Update the order
    await db.update(deliveryOrders)
      .set({ batchId: targetBatchId || null })
      .where(eq(deliveryOrders.id, orderId));

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('API /admin/batching/move Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function recalculateBatch(batchId: number) {
  const items = await db.select().from(deliveryBatchItems).where(eq(deliveryBatchItems.batchId, batchId));
  
  if (items.length === 0) {
    // Delete the empty batch
    await db.delete(deliveryBatches).where(eq(deliveryBatches.id, batchId));
    return;
  }

  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalWgt = items.reduce((sum, item) => sum + Number(item.customerWeight || 0), 0);

  await db.update(deliveryBatches)
    .set({
      totalQuantity: totalQty,
      totalWeight: totalWgt.toString(),
    })
    .where(eq(deliveryBatches.id, batchId));
}
