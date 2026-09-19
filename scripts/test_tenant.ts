import * as dotenv from 'dotenv';
dotenv.config();
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DATABASE_URL!.replace(':6543', ':5432'), {ssl:'require', max:1});
  const res = await sql`SELECT id, name, address, lat, lng FROM tenants`;
  console.log(res);
  await sql.end();
}
main();
