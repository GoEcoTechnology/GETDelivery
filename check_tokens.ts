import 'dotenv/config';
import { db } from './src/db';
import { deviceTokens } from './src/db/schema';

async function main() {
  const tokens = await db.select().from(deviceTokens);
  console.log(`Found ${tokens.length} tokens in DB:`);
  console.log(tokens);
  process.exit(0);
}
main().catch(console.error);
