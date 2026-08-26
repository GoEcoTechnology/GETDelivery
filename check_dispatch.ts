import 'dotenv/config';
import { db } from './src/db';
import { deliveryOrders, deliveryInvitations, partnerNotifications } from './src/db/schema';
import { eq, desc } from 'drizzle-orm';

async function main() {
  const orders = await db.select().from(deliveryOrders);
  const invitations = await db.select().from(deliveryInvitations).limit(5);
  const notifications = await db.select().from(partnerNotifications).limit(5);
  
  console.log('Latest Order:', orders[0]);
  console.log('Invitations:', invitations);
  console.log('Notifications:', notifications);
  
  process.exit(0);
}

main().catch(console.error);
