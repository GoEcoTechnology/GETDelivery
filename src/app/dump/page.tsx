import { db } from '@/db';
import { deliveryOrders } from '@/db/schema';
import { desc } from 'drizzle-orm';

export default async function DumpPage() {
  const orders = await db.select().from(deliveryOrders).orderBy(desc(deliveryOrders.id)).limit(3);
  return <pre>{JSON.stringify(orders, null, 2)}</pre>;
}
