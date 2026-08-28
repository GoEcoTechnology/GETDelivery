import 'dotenv/config';
import { db } from './src/db';
import { sql } from 'drizzle-orm';

async function main() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS device_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_role VARCHAR(50) NOT NULL,
      tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
      fcm_token TEXT NOT NULL UNIQUE,
      device_name VARCHAR(255),
      browser VARCHAR(100),
      operating_system VARCHAR(100),
      last_seen TIMESTAMP DEFAULT NOW() NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS dt_user_idx ON device_tokens (user_id, user_role);
    CREATE INDEX IF NOT EXISTS dt_token_idx ON device_tokens (fcm_token);
  `);
  console.log("Table created");
  process.exit(0);
}
main().catch(console.error);
