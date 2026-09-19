import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

async function applyMigrations() {
  const sql = postgres(process.env.DATABASE_URL as string, { ssl: 'require', max: 1 });
  
  try {
    console.log('Connecting to database...');
    
    // Read migrations
    const migration12Path = path.join(process.cwd(), 'src/db/migrations/0012_schema_refactor.sql');
    const migration13Path = path.join(process.cwd(), 'src/db/migrations/0013_rls_policies.sql');
    const migration14Path = path.join(process.cwd(), 'src/db/migrations/0014_product_architecture.sql');
    const migration15Path = path.join(process.cwd(), 'src/db/migrations/0015_add_weight.sql');
    const migration16Path = path.join(process.cwd(), 'src/db/migrations/0016_cart_selling_unit.sql');
    const migration17Path = path.join(process.cwd(), 'src/db/migrations/0017_add_quota.sql');
    const migration18Path = path.join(process.cwd(), 'src/db/migrations/0018_variant_quantity_selling_unit_description.sql');
    
    const migration12 = fs.readFileSync(migration12Path, 'utf8');
    const migration13 = fs.readFileSync(migration13Path, 'utf8');
    const migration14 = fs.readFileSync(migration14Path, 'utf8');
    const migration15 = fs.readFileSync(migration15Path, 'utf8');
    const migration16 = fs.readFileSync(migration16Path, 'utf8');
    const migration17 = fs.readFileSync(migration17Path, 'utf8');
    const migration18 = fs.readFileSync(migration18Path, 'utf8');
    
    console.log('Applying Migration 0012: Schema Refactor...');
    // await sql.unsafe(migration12); // Already applied
    console.log('Applying Migration 0013: RLS Policies...');
    // await sql.unsafe(migration13); // Already applied
    console.log('Applying Migration 0014: Product Architecture...');
    // await sql.unsafe(migration14); // Already applied
    console.log('Applying Migration 0015: Add weight...');
    // await sql.unsafe(migration15);
    console.log('Applying Migration 0016: Add cart selling unit...');
    // await sql.unsafe(migration16);
    console.log('Applying Migration 0017: Add quota...');
    await sql.unsafe(migration17);
    console.log('Migration 0017 applied successfully.');
    console.log('Applying Migration 0018: Variant quantity and selling-unit description...');
    await sql.unsafe(migration18);
    console.log('Migration 0018 applied successfully.');
    
    console.log('All migrations applied successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

applyMigrations();
