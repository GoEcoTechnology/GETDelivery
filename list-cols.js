const postgres = require('postgres');
require('dotenv').config({ path: '.env' });
const sql = postgres(process.env.DATABASE_URL);
async function test() {
  const columns = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'delivery_orders'`;
  console.log(columns.map(c => c.column_name));
  process.exit(0);
}
test();
