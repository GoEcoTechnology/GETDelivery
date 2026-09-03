const postgres = require('postgres');
const sql = postgres('postgresql://postgres.hfvqqhryywkzhsolfdcm:GETDelivery%40123@db.hfvqqhryywkzhsolfdcm.supabase.co:5432/postgres?sslmode=require');
sql`SELECT * FROM users LIMIT 1`.then(res => {
  console.log('Direct Connection Success!');
  process.exit(0);
}).catch(err => {
  console.error('Direct Connection Error:', err);
  process.exit(1);
});
