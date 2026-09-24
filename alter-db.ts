import { db } from './src/db/index.js';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    await db.execute(sql`ALTER TABLE platform_delivery_settings ADD COLUMN IF NOT EXISTS urgent_delivery_fee numeric(10, 2) DEFAULT '0' NOT NULL`);
    console.log('Column added successfully!');
  } catch(e: any) {
    console.error('ERROR:', e.message);
  }
  process.exit(0);
}

main();
