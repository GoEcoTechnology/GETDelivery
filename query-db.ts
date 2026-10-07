import { config } from 'dotenv';
config();
import { db } from './src/db';
import { deliveryOrders } from './src/db/schema';
import { desc } from 'drizzle-orm';

async function main() {
  const orders = await db.select({
    id: deliveryOrders.id,
    status: deliveryOrders.status,
    batchId: deliveryOrders.batchId,
    total: deliveryOrders.offeredAmount
  }).from(deliveryOrders).orderBy(desc(deliveryOrders.createdAt)).limit(10);
  console.log(orders);
  process.exit(0);
}
main();
