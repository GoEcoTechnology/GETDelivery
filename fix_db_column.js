const postgres = require('postgres');
const sql = postgres('postgresql://postgres.hfvqqhryywkzhsolfdcm:GETDelivery%40123@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require');
sql`ALTER TABLE vehicle_delivery_rates ADD COLUMN IF NOT EXISTS price_per_km decimal(10, 2) DEFAULT 0 NOT NULL;`.then(res => {
  console.log('Column added successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Error adding column:', err);
  process.exit(1);
});
