import 'dotenv/config';
import { db } from '../src/db/index';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS parent_order_id INTEGER REFERENCES delivery_orders(id) ON DELETE SET NULL;`);
    console.log('Column added');
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
main();
