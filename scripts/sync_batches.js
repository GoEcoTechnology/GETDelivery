require('dotenv').config();
const postgres = require('postgres');

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const sql = postgres(connectionString, { ssl: 'require' });

  try {
    const batches = await sql`SELECT id FROM delivery_batches`;
    for (const b of batches) {
      const orders = await sql`SELECT status FROM delivery_orders WHERE batch_id = ${b.id}`;
      if (orders.length > 0) {
        const status = orders[0].status;
        await sql`UPDATE delivery_batches SET status = ${status} WHERE id = ${b.id}`;
        console.log(`Synced batch ${b.id} to ${status}`);
      }
    }
  } catch (err) {
    console.error('Failed:', err);
  } finally {
    await sql.end();
  }
}

run();
