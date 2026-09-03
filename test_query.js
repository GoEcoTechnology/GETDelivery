const postgres = require('postgres');
const sql = postgres('postgresql://postgres.hfvqqhryywkzhsolfdcm:GETDelivery%40123@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require');
sql`select "id", "tenant_id", "name", "first_name", "last_name", "contact_number", "email", "password_hash", "role", "status", "created_at" from "users" where "users"."email" = 'anjelozp@gmail.com'`.then(res => {
  console.log('Users found:', res.length);
  console.log(res);
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
