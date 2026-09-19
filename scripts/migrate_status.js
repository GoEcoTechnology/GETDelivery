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
    console.log('Migrating DISPATCHED to WAITING_FOR_PARTNER...');
    const res1 = await sql`UPDATE delivery_orders SET status = 'WAITING_FOR_PARTNER' WHERE status = 'DISPATCHED'`;
    console.log(`Updated ${res1.count} rows.`);

    console.log('Migrating ASSIGNED to ACCEPTED...');
    const res2 = await sql`UPDATE delivery_orders SET status = 'ACCEPTED' WHERE status = 'ASSIGNED'`;
    console.log(`Updated ${res2.count} rows.`);
    
    console.log('Migrating delivery_assignments status ASSIGNED to ACCEPTED...');
    const res3 = await sql`UPDATE delivery_assignments SET status = 'ACCEPTED' WHERE status = 'ASSIGNED'`;
    console.log(`Updated ${res3.count} rows in delivery_assignments.`);
    
    console.log('Migrating delivery_invitations status ASSIGNED to ACCEPTED...');
    const res4 = await sql`UPDATE delivery_invitations SET status = 'ACCEPTED' WHERE status = 'ASSIGNED'`;
    console.log(`Updated ${res4.count} rows in delivery_invitations.`);

    console.log('Migrating delivery_batches status DISPATCHED to WAITING_FOR_PARTNER...');
    const res5 = await sql`UPDATE delivery_batches SET status = 'WAITING_FOR_PARTNER' WHERE status = 'DISPATCHED'`;
    console.log(`Updated ${res5.count} rows in delivery_batches.`);

    console.log('Migrating delivery_batches status ASSIGNED to ACCEPTED...');
    const res6 = await sql`UPDATE delivery_batches SET status = 'ACCEPTED' WHERE status = 'ASSIGNED'`;
    console.log(`Updated ${res6.count} rows in delivery_batches.`);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await sql.end();
  }
}

run();
