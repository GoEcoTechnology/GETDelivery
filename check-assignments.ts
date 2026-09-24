import { db } from './src/db/index.js';
import { deliveryAssignments, deliveryOrders } from './src/db/schema.js';

async function main() {
  const a = await db.select().from(deliveryAssignments);
  const o = await db.select().from(deliveryOrders);
  console.log('Assignments:', a);
  console.log('Orders:', o.map(x=>({id:x.id, status:x.status, temporaryWinnerId:x.temporaryWinnerId})));
  process.exit(0);
}

main();
