const postgres = require('postgres');
const sql = postgres('postgresql://postgres.hfvqqhryywkzhsolfdcm:GETDelivery%40123@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require');
sql`SELECT * FROM vehicle_delivery_rates LIMIT 1`.then(res => {
  console.log('Rates found:', res.length);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
