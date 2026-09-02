const postgres = require('postgres');
require('dotenv').config({ path: '.env' });
const sql = postgres(process.env.DATABASE_URL);
async function fix() {
  try {
    await sql`ALTER TABLE delivery_orders ADD COLUMN required_vehicle_type VARCHAR(100)`;
    console.log('Added required_vehicle_type');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}
fix();
