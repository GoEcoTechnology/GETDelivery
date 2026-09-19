const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function enableRLS() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public';
    `);

    const tables = result.rows.map(row => row.tablename);
    console.log(`Found ${tables.length} tables in public schema.`);

    for (const table of tables) {
      console.log(`Enabling RLS on table: ${table}`);
      await pool.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
    }

    console.log('\n✅ Successfully enabled Row Level Security (RLS) on all tables.');
    console.log('⚠️  Note: You must now create RLS policies for these tables (e.g., in Supabase Dashboard) otherwise all access will be blocked!');
  } catch (error) {
    console.error('Error enabling RLS:', error);
  } finally {
    await pool.end();
  }
}

enableRLS();
