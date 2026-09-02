const postgres = require('postgres');
require('dotenv').config({ path: '.env' });
const sql = postgres(process.env.DATABASE_URL);
async function test() {
  try {
    const hugeString = '[' + new Array(10000).fill('[12.97867,124.013027]').join(',') + ']';
    const query = `insert into "delivery_orders" ("tenant_id", "customer_id", "customer_name", "customer_contact", "pickup_address", "dropoff_address", "pickup_lat", "pickup_lng", "dropoff_lat", "dropoff_lng", "route_distance", "route_duration", "route_polyline", "delivery_date", "instructions", "preferred_vehicle", "status", "current_orders_count") values (1, 1, 'Alpha', '0917', 'A', 'B', 12.9786499, 124.0136316, 18.166667, 120.75, '1km', '1m', $1, '2026-09-03T05:46:00.000Z', 'Fragile', 'Motorcycle', 'DRAFT', 32) returning "id"`;
    await sql.unsafe(query, [hugeString]);
    console.log('Success!');
  } catch (e) {
    console.error('Error properties:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
  }
  process.exit(0);
}
test();
