import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    await sql`ALTER TABLE customers ALTER COLUMN customer_code DROP NOT NULL`;
    console.log("Successfully dropped NOT NULL constraint from customer_code");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
main();
