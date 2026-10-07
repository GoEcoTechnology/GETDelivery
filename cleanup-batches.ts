import { config } from 'dotenv';
config({path: '.env'});
import { db } from './src/db';
import { deliveryOrders, deliveryBatches, deliveryBatchItems } from './src/db/schema';
import { eq, inArray, and } from 'drizzle-orm';

async function main() {
  // Find batch items whose deliveryOrder is CANCELLED
  const cancelledOrders = await db.select({ id: deliveryOrders.id }).from(deliveryOrders).where(eq(deliveryOrders.status, 'CANCELLED'));
  const cancelledOrderIds = cancelledOrders.map(o => o.id);

  if (cancelledOrderIds.length > 0) {
    const invalidBatchItems = await db.select().from(deliveryBatchItems).where(inArray(deliveryBatchItems.customerOrderId, cancelledOrderIds));
    
    for (const item of invalidBatchItems) {
      console.log(`Fixing batch item ${item.id} for cancelled order ${item.customerOrderId} in batch ${item.batchId}`);
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
    }
  }

  // Also remove batchId from cancelled orders just in case
  if (cancelledOrderIds.length > 0) {
    await db.update(deliveryOrders).set({ batchId: null }).where(inArray(deliveryOrders.id, cancelledOrderIds));
  }

  console.log('Cleanup complete');
  process.exit(0);
}
main();
