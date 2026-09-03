const postgres = require('postgres');
const sql = postgres('postgresql://postgres.hfvqqhryywkzhsolfdcm:GETDelivery%40123@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require');
sql`SELECT "id", "vehicle_type", "base_price", "price_per_km", "is_active", "updated_by", "updated_at" FROM "vehicle_delivery_rates" WHERE "vehicle_delivery_rates"."vehicle_type" = 'Motorcycle' AND "vehicle_delivery_rates"."is_active" = true`.then(res => {
  console.log('Rates found:', res.length);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
