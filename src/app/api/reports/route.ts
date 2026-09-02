import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, products } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, {}, async (tx, claims) => {
    try {
      // Employees cannot access reports
      if (claims.role === 'EMPLOYEE') {
        return NextResponse.json({ error: 'Access denied. Employees cannot view reports.' }, { status: 403 });
      }

      const tenantId = claims.tenantId as number | null;
      if (!tenantId) {
        return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
      }

      // Using SQL aggregations to avoid fetching large datasets into Node memory
      const [deliveryStats] = await tx
        .select({
          totalDeliveries: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where status = 'DELIVERED' or status = 'COMPLETED')`,
          inTransit: sql<number>`count(*) filter (where status = 'IN_TRANSIT')`,
          pending: sql<number>`count(*) filter (where status = 'DRAFT' or status = 'CONFIRMED' or status = 'READY_FOR_DISPATCH')`,
        })
        .from(deliveryOrders)
        .where(eq(deliveryOrders.tenantId, tenantId));

      const [inventoryStats] = await tx
        .select({
          totalProducts: sql<number>`count(*)`,
          lowStockItems: sql<number>`count(*) filter (where stock <= low_stock_threshold)`,
          totalStock: sql<number>`sum(stock)`,
        })
        .from(products)
        .where(eq(products.tenantId, tenantId));

      return NextResponse.json({
        data: {
          deliveries: deliveryStats,
          inventory: inventoryStats,
        }
      });
    } catch (error) {
      console.error('Reports error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
