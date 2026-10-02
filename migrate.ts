import postgres from 'postgres';

async function run() {
  const sql = postgres('postgresql://postgres.hfvqqhryywkzhsolfdcm:GETDelivery%40123@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require');
  
  await sql`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS basis_product_id INTEGER;`;
  await sql`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS basis_variant_id INTEGER;`;
  await sql`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS basis_quantity INTEGER NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS has_basis_tie BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE delivery_batches ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2);`;
  
  console.log('Migration done');
  process.exit(0);
}

run().catch(console.error);
