import { db } from './src/db/index.js';
import { deliveryPartners } from './src/db/schema.js';

async function check() {
  const p = await db.select().from(deliveryPartners);
  console.log(p);
}
check().catch(console.error).finally(() => process.exit(0));
