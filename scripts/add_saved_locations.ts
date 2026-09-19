import * as dotenv from 'dotenv';
dotenv.config();

import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Adding saved_locations to customers...');
    await db.execute(sql`ALTER TABLE customers ADD COLUMN saved_locations JSONB DEFAULT '[]' NOT NULL;`);
    console.log('Successfully added saved_locations column.');
  } catch (err: any) {
    if (err.message && err.message.includes('already exists')) {
      console.log('Column already exists.');
    } else {
      console.error('Error:', err);
    }
  }
  process.exit(0);
}

main();
