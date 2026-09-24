require('dotenv').config({ path: '.env' });
import postgres from 'postgres';

async function main() {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    await sql`TRUNCATE TABLE delivery_batches, delivery_orders CASCADE`;
    console.log('Successfully truncated tables.');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
main();
