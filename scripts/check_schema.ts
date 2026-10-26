import postgres from 'postgres';
import 'dotenv/config';

async function checkSchema() {
  const sql = postgres(process.env.DATABASE_URL as string, { ssl: 'require', max: 1 });
  try {
    const tables = ['products', 'product_variants', 'product_selling_units', 'vehicles', 'delivery_orders', 'vehicle_delivery_rates'];
    for (const t of tables) {
      const cols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${t} ORDER BY ordinal_position`;
      console.log(`\nTable ${t}:`);
      cols.forEach((c: any) => console.log(`  - ${c.column_name}: ${c.data_type}`));
    }
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await sql.end();
  }
}

checkSchema();
