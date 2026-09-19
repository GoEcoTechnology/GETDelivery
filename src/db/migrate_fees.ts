import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from './index';

async function main() {
  try {
    console.log('Adding columns...');
    await db.execute(sql`ALTER TABLE "vehicle_delivery_rates" ADD COLUMN IF NOT EXISTS "urgent_additional_fee" numeric(10, 2) DEFAULT '0' NOT NULL;`);
    await db.execute(sql`ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "normal_delivery_fee" numeric(10, 2);`);
    await db.execute(sql`ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "urgent_additional_fee" numeric(10, 2);`);
    console.log('Columns added successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error adding columns:', err);
    process.exit(1);
  }
}

main();
