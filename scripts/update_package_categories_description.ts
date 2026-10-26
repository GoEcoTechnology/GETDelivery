import 'dotenv/config';
import postgres from 'postgres';

async function migrate() {
  const sql = postgres(process.env.DATABASE_URL as string, { ssl: 'require', max: 1 });
  try {
    console.log('Adding description column to package_categories...');
    await sql.unsafe(`
      ALTER TABLE "package_categories" 
      ADD COLUMN IF NOT EXISTS "description" text;
    `);

    console.log('Updating package categories with names (Small, Med, Large, XL, etc.) and range descriptions...');
    
    // Update or insert with clear names and range descriptions
    await sql.unsafe(`
      UPDATE "package_categories"
      SET 
        "name" = 'Small',
        "description" = 'Up to 3 kg | Max 25 × 20 × 10 cm (Small pouches, documents, accessories, cosmetics)'
      WHERE "code" = 'SMALL';

      UPDATE "package_categories"
      SET 
        "name" = 'Med',
        "description" = 'Up to 10 kg | Max 40 × 30 × 20 cm (Shoeboxes, folded clothes, small electronics)'
      WHERE "code" = 'MEDIUM' OR "code" = 'MED';

      UPDATE "package_categories"
      SET 
        "name" = 'Large',
        "description" = 'Up to 25 kg | Max 60 × 45 × 35 cm (Microwaves, bulk groceries, kitchen appliances)'
      WHERE "code" = 'LARGE';

      UPDATE "package_categories"
      SET 
        "name" = 'XL',
        "description" = 'Up to 50 kg | Max 100 × 70 × 60 cm (TVs, medium furniture, multi-item cartons)'
      WHERE "code" = 'EXTRA_LARGE' OR "code" = 'XL';

      UPDATE "package_categories"
      SET 
        "name" = 'Oversized',
        "description" = 'Up to 200 kg | Max 180 × 120 × 100 cm (Refrigerators, heavy appliances, large crates)'
      WHERE "code" = 'OVERSIZED';

      UPDATE "package_categories"
      SET 
        "name" = 'Freight / Cargo',
        "description" = 'Above 200 kg or >180 cm (Palletized cargo, industrial equipment, construction materials)'
      WHERE "code" = 'FREIGHT_CARGO';
    `);

    const rows = await sql`SELECT code, name, description, max_weight_kg, max_length_cm, max_width_cm, max_height_cm FROM package_categories ORDER BY sort_order;`;
    console.log('Updated package_categories:', rows);
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
