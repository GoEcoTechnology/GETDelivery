import { config } from 'dotenv';
config({ path: '.env' });
async function run() {
  const { db } = require('./src/db/index');
  const { deliveryOrders, deliveryBatches, deliveryBatchItems, drivers, vehicles } = require('./src/db/schema');
  const { inArray } = require('drizzle-orm');

  await db.update(deliveryOrders)
    .set({ orderSource: 'MARKETPLACE', batchId: null, status: 'WAITING' })
    .where(inArray(deliveryOrders.customerName, ['Angel Ortiz', 'John Rick Dominguez']));
    
  await db.delete(deliveryBatchItems).where(inArray(deliveryBatchItems.batchId, [27, 28]));
  await db.delete(deliveryBatches).where(inArray(deliveryBatches.id, [27, 28]));

  // Reset all drivers and vehicles to ACTIVE so they don't disappear
  await db.update(drivers).set({ status: 'ACTIVE' });
  await db.update(vehicles).set({ status: 'ACTIVE' });

  console.log('Fixed DB state back to original!');
  process.exit(0);
}
run();
