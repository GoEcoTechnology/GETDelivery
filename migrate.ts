import postgres from 'postgres';

async function run() {
  const sql = postgres('postgresql://postgres.hfvqqhryywkzhsolfdcm:GETDelivery%40123@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require');
  
  await sql`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS basis_product_id INTEGER;`;
  await sql`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS basis_variant_id INTEGER;`;
  await sql`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS basis_quantity INTEGER NOT NULL DEFAULT 0;`;
  await sql`ALTER TABLE delivery_orders ADD COLUMN IF NOT EXISTS has_basis_tie BOOLEAN NOT NULL DEFAULT false;`;
  await sql`ALTER TABLE delivery_batches ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2);`;
  await sql`ALTER TABLE platform_delivery_settings ADD COLUMN IF NOT EXISTS volumetric_divisor INTEGER NOT NULL DEFAULT 5000;`;
  await sql`ALTER TABLE platform_delivery_settings ADD COLUMN IF NOT EXISTS base_weight_kg NUMERIC(10,2) NOT NULL DEFAULT 1.00;`;
  await sql`ALTER TABLE platform_delivery_settings ADD COLUMN IF NOT EXISTS base_weight_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;`;
  await sql`ALTER TABLE platform_delivery_settings ADD COLUMN IF NOT EXISTS incremental_weight_rate NUMERIC(10,2) NOT NULL DEFAULT 10.00;`;
  
  console.log('Migration done');
  process.exit(0);
}

run().catch(console.error);
