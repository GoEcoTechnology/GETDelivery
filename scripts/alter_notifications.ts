import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  const sql = postgres(process.env.DATABASE_URL!);
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at timestamp;`;
  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS failed_at timestamp;`;
  console.log('Done altering table!');
  process.exit(0);
}
run();
