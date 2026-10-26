import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function run() {
  const sql = postgres(process.env.DATABASE_URL as string, { ssl: 'require', max: 1 });
  try {
    console.log('Connecting to database...');
    
    // Check and apply migration 19 first if needed
    const m19Path = path.join(process.cwd(), 'src/db/migrations/0019_add_vehicle_weight_and_selection.sql');
    if (fs.existsSync(m19Path)) {
      console.log('Applying Migration 0019...');
      const m19 = fs.readFileSync(m19Path, 'utf8');
      await sql.unsafe(m19);
      console.log('Migration 0019 applied.');
    }

    // Apply migration 20
    const m20Path = path.join(process.cwd(), 'src/db/migrations/0020_product_dimensions_and_package_categories.sql');
    console.log('Applying Migration 0020...');
    const m20 = fs.readFileSync(m20Path, 'utf8');
    await sql.unsafe(m20);
    console.log('Migration 0020 applied successfully!');

    // Verify columns on products
    const pCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position`;
    console.log('\nVerified products columns:', pCols.map((c: any) => c.column_name));

    // Verify columns on vehicles
    const vCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicles' ORDER BY ordinal_position`;
    console.log('Verified vehicles columns:', vCols.map((c: any) => c.column_name));

    // Verify package_categories count
    const cats = await sql`SELECT * FROM package_categories ORDER BY sort_order`;
    console.log('\nPackage categories in DB:');
    cats.forEach((c: any) => console.log(`  - ${c.code}: ${c.name} (Max: ${c.max_length_cm}x${c.max_width_cm}x${c.max_height_cm} cm, ${c.max_weight_kg} kg)`));

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
