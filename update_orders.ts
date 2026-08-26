import { config } from 'dotenv';
config();
const { db } = require('./src/db/index');
const { deliveryOrders } = require('./src/db/schema');
const { inArray } = require('drizzle-orm');


async function updateOrders() {
  console.log('Updating PENDING_ACCUMULATION and ACCUMULATING orders to READY_FOR_DISPATCH...');
  const res = await db.update(deliveryOrders)
    .set({ status: 'READY_FOR_DISPATCH', batchId: null })
    .where(inArray(deliveryOrders.status, ['PENDING_ACCUMULATION', 'ACCUMULATING']))
    .returning();
  console.log(`Updated ${res.length} orders.`);
  process.exit(0);
}

updateOrders().catch(err => {
  console.error(err);
  process.exit(1);
});
