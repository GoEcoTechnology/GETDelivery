import { config } from 'dotenv';
config({ path: '.env' });
async function run() {
  const { db } = require('./src/db/index');
  const { deliveryOrders, deliveryBatches, deliveryBatchItems, drivers, vehicles } = require('./src/db/schema');
  const { inArray, eq } = require('drizzle-orm');

  const orders = await db.select().from(deliveryOrders).where(eq(deliveryOrders.customerName, 'John Rick Dominguez'));
  const orderIds = orders.map((o: any) => o.id);
  
  if (orderIds.length > 0) {
    const items = await db.select().from(deliveryBatchItems).where(inArray(deliveryBatchItems.customerOrderId, orderIds));
    const batchIds = items.map((i: any) => i.batchId);
    if (batchIds.length > 0) {
      await db.delete(deliveryBatchItems).where(inArray(deliveryBatchItems.batchId, batchIds));
      await db.delete(deliveryBatches).where(inArray(deliveryBatches.id, batchIds));
    }
    await db.update(deliveryOrders)
      .set({ orderSource: 'MARKETPLACE', batchId: null, status: 'WAITING' })
      .where(inArray(deliveryOrders.id, orderIds));
  }
  
  // Reset all drivers and vehicles to ACTIVE so they don't disappear
  await db.update(drivers).set({ status: 'ACTIVE' });
  await db.update(vehicles).set({ status: 'ACTIVE' });

  console.log('Fixed DB state perfectly!');
  process.exit(0);
}
run();
