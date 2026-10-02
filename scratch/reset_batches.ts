import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function resetBatches() {
  await db.execute(sql`DELETE FROM delivery_batch_items;`);
  await db.execute(sql`DELETE FROM delivery_batches;`);
  await db.execute(sql`UPDATE delivery_orders SET status='DRAFT', batch_id=NULL;`);
  console.log('RESET DONE');
  process.exit(0);
}

resetBatches().catch(console.error);
