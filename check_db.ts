import { db } from './src/db/index.js';
import { deviceTokens, notificationQueue } from './src/db/schema.js';

async function check() {
  const tokens = await db.select().from(deviceTokens);
  console.log('--- DEVICE TOKENS ---');
  console.log(tokens);

  const q = await db.select().from(notificationQueue).orderBy(notificationQueue.id);
  console.log('--- NOTIFICATION QUEUE ---');
  console.log(q.slice(-5)); // Last 5
}
check().catch(console.error).finally(() => process.exit(0));
