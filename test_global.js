const postgres = require('postgres');
const sql = postgres('postgresql://postgres.hfvqqhryywkzhsolfdcm:GETDelivery%40123@pooler.supabase.com:6543/postgres?sslmode=require');
sql`SELECT * FROM users LIMIT 1`.then(res => {
  console.log('Global Pooler Connection Success!');
  process.exit(0);
}).catch(err => {
  console.error('Global Pooler Error:', err);
  process.exit(1);
});
