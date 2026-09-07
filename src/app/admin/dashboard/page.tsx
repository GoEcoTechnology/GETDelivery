import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import styles from '../admin.module.css';
import { db } from '@/db';
import { deliveryOrders, tenants, customers } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const claims = await verifyToken(token);
  if (!claims) {
    redirect('/login');
  }

  const { range: rangeParam } = await searchParams;
  const range = rangeParam || 'month';

  const isPlatformOwner = claims.role === 'PLATFORM_OWNER';
  const tenantId = claims.tenantId as number;

  const deliveriesQuery = db.select({
    id: deliveryOrders.id,
    deliveryDate: deliveryOrders.deliveryDate,
    dropoffAddress: deliveryOrders.dropoffAddress,
    pickupAddress: deliveryOrders.pickupAddress,
    customerName: customers.name,
    status: deliveryOrders.status,
  })
  .from(deliveryOrders)
  .leftJoin(customers, eq(deliveryOrders.customerId, customers.id))
  .where(inArray(deliveryOrders.status, ['PENDING', 'DISPATCHED', 'ACCEPTED', 'ASSIGNED', 'TEMPORARY_WINNER', 'IN_TRANSIT']));

  const rawDeliveries = isPlatformOwner 
    ? await deliveriesQuery 
    : await deliveriesQuery.where(eq(deliveryOrders.tenantId, tenantId));

  const calendarDeliveries = rawDeliveries.map(d => ({
    id: d.id,
    deliveryDate: d.deliveryDate,
    tenantName: d.customerName || 'Unknown Customer',
    pickupAddress: d.pickupAddress || '',
    dropoffAddress: d.dropoffAddress,
    status: d.status,
  }));

  return <DashboardClient currentRange={range} calendarDeliveries={calendarDeliveries} />;
}
