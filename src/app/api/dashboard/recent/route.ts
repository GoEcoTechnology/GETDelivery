import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, customers } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(req: Request) {
  return withAuth(req, async (tx, claims) => {
    try {
      const isPlatformOwner = claims.role === 'PLATFORM_OWNER';
      const tenantId = claims.tenantId as number;

      const deliveriesBase = tx
        .select()
        .from(deliveryOrders)
        .orderBy(desc(deliveryOrders.createdAt))
        .limit(5);

      const customersBase = tx
        .select()
        .from(customers)
        .orderBy(desc(customers.createdAt))
        .limit(5);

      const [deliveries, customersList] = await Promise.all([
        isPlatformOwner
          ? deliveriesBase
          : deliveriesBase.where(eq(deliveryOrders.tenantId, tenantId)),
        isPlatformOwner
          ? customersBase
          : customersBase.where(eq(customers.tenantId, tenantId)),
      ]);

      return NextResponse.json({
        recentDeliveries: deliveries,
        recentCustomers: customersList
      });
    } catch (error) {
      console.error('Failed to fetch recent data:', error);
      return NextResponse.json({ error: 'Failed to fetch recent data' }, { status: 500 });
    }
  });
}
