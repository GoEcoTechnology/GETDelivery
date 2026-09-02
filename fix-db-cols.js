const postgres = require('postgres');
require('dotenv').config({ path: '.env' });
const sql = postgres(process.env.DATABASE_URL);
async function fix() {
  try {
    await sql`ALTER TABLE delivery_orders ADD COLUMN vehicle_base_price DECIMAL(10,2)`;
    await sql`ALTER TABLE delivery_orders ADD COLUMN price_per_km DECIMAL(10,2)`;
    await sql`ALTER TABLE delivery_orders ADD COLUMN distance_km DECIMAL(10,2)`;
    await sql`ALTER TABLE delivery_orders ADD COLUMN final_delivery_price DECIMAL(10,2)`;
    await sql`ALTER TABLE delivery_orders ADD COLUMN pricing_frozen_at TIMESTAMP`;
    console.log('Added all missing columns');
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}
fix();
