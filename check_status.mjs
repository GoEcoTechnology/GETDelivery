import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function main() {
  try {
    const res = await sql`DELETE FROM users WHERE email = 'anjeloqp@gmail.com' AND role = 'EMPLOYEE'`;
    console.log("Deleted Employee anjeloqp@gmail.com to resolve the email conflict with the Delivery Partner account.");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

main();
