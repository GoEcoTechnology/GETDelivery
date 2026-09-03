import { db } from '../db';
import { notifications } from '../db/schema';
import { desc } from 'drizzle-orm';

async function check() {
  const notifs = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(5);
  console.log(JSON.stringify(notifs, null, 2));
}
check().catch(console.error).then(() => process.exit(0));
