const postgres = require('postgres');
require('dotenv').config({ path: '.env' });
const sql = postgres(process.env.DATABASE_URL);
async function test() {
  const policies = await sql`SELECT tablename, qual, with_check FROM pg_policies WHERE tablename = 'delivery_orders'`;
  console.log(policies);
  process.exit(0);
}
test();
