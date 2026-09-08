import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    const customers = await sql`SELECT id, name, tenant_id FROM customers`;
    console.log("ALL CUSTOMERS:", customers);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
main();
