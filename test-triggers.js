const postgres = require('postgres');
require('dotenv').config({ path: '.env' });
const sql = postgres(process.env.DATABASE_URL);
async function test() {
  const triggers = await sql`SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers WHERE event_object_table = 'delivery_orders'`;
  console.log(triggers);
  process.exit(0);
}
test();
