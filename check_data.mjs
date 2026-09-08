import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    // For each tenant, take one driver and set delivery_partner_id = null
    const tenants = await sql`SELECT id FROM tenants`;
    
    for (const t of tenants) {
      // update 1 driver
      await sql`
        UPDATE drivers 
        SET delivery_partner_id = NULL 
        WHERE id IN (
          SELECT id FROM drivers WHERE tenant_id = ${t.id} LIMIT 2
        )
      `;
      // update 1 vehicle
      await sql`
        UPDATE vehicles 
        SET delivery_partner_id = NULL 
        WHERE id IN (
          SELECT id FROM vehicles WHERE tenant_id = ${t.id} LIMIT 2
        )
      `;
    }
    
    console.log("Successfully set some drivers and vehicles to be internal (own transport)!");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
