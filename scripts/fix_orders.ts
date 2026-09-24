import { db } from '../src/db/index';
import { deliveryOrders } from '../src/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';

async function main() {
  const result = await db.update(deliveryOrders)
    .set({ orderSource: 'SUB_ORDER' })
    .where(and(
      eq(deliveryOrders.orderSource, 'CREATED'),
      isNotNull(deliveryOrders.customerId)
    ))
    .returning({ id: deliveryOrders.id });
  console.log('Fixed:', result.length);
  process.exit(0);
}
main();
