import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryBatches, deliveryBatchItems } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function GET() {
  try {
    const cancelledOrders = await db.select({ id: deliveryOrders.id }).from(deliveryOrders).where(eq(deliveryOrders.status, 'CANCELLED'));
    const cancelledOrderIds = cancelledOrders.map(o => o.id);

    let fixedCount = 0;
    if (cancelledOrderIds.length > 0) {
      const invalidBatchItems = await db.select().from(deliveryBatchItems).where(inArray(deliveryBatchItems.customerOrderId, cancelledOrderIds));
      
      for (const item of invalidBatchItems) {
        const batch = await db.query.deliveryBatches.findFirst({ where: eq(deliveryBatches.id, item.batchId) });
        if (batch) {
          const newQty = Math.max(0, batch.totalQuantity - item.quantity);
          const newWeight = Math.max(0, Number(batch.totalWeight) - Number(item.customerWeight));
          
          await db.update(deliveryBatches)
            .set({ totalQuantity: newQty, totalWeight: newWeight.toString() })
            .where(eq(deliveryBatches.id, batch.id));
            
          if (newQty === 0) {
             await db.delete(deliveryBatches).where(eq(deliveryBatches.id, batch.id));
          }
        }
        await db.delete(deliveryBatchItems).where(eq(deliveryBatchItems.id, item.id));
        fixedCount++;
      }
      
      await db.update(deliveryOrders).set({ batchId: null }).where(inArray(deliveryOrders.id, cancelledOrderIds));
    }

    return NextResponse.json({ success: true, fixedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
