const postgres = require('postgres');
const sql = postgres('postgresql://postgres.hfvqqhryywkzhsolfdcm:GETDelivery%40123@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require');
sql`ALTER TABLE delivery_orders 
  ADD COLUMN IF NOT EXISTS offered_amount decimal(10, 2),
  ADD COLUMN IF NOT EXISTS required_vehicle_type varchar(100),
  ADD COLUMN IF NOT EXISTS vehicle_base_price decimal(10, 2),
  ADD COLUMN IF NOT EXISTS price_per_km decimal(10, 2),
  ADD COLUMN IF NOT EXISTS distance_km decimal(10, 2),
  ADD COLUMN IF NOT EXISTS final_delivery_price decimal(10, 2),
  ADD COLUMN IF NOT EXISTS pricing_frozen_at timestamp,
  ADD COLUMN IF NOT EXISTS temporary_winner_id integer;
`.then(res => {
  console.log('Delivery orders columns synced!');
  process.exit(0);
}).catch(err => {
  console.error('Error syncing delivery orders:', err);
  process.exit(1);
});
