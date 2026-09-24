import 'dotenv/config';
import postgres from 'postgres';

async function run() {
  const sql = postgres(process.env.DATABASE_URL!);
  try {
    await sql`insert into customers(tenant_id, user_id, name, mobile_number, address, status) values (18, 8, 'Guest Customer', 'N/A', 'Test Addr', 'ACTIVE')`;
    console.log('success');
  } catch(e: any) {
    console.log(e.message);
    console.log(e.code);
    console.log(e.detail);
  }
  process.exit(0);
}
run();
