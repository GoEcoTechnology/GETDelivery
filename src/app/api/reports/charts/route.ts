import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, products, inventoryTransactions } from '@/db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['reports.view'] }, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'week'; // week, month, year

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;

    // Calculate start date based on range
    const now = new Date();
    let startDate = new Date();
    if (range === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (range === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (range === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    try {
      // 1. Delivery Status Distribution (Donut Chart)
      let statusQuery = tx.select({
        status: deliveryOrders.status,
        value: sql<number>`count(*)::int`
      }).from(deliveryOrders)
      .where(gte(deliveryOrders.createdAt, startDate))
      .groupBy(deliveryOrders.status);

      if (tenantIdToUse) {
        statusQuery = tx.select({
          status: deliveryOrders.status,
          value: sql<number>`count(*)::int`
        }).from(deliveryOrders)
        .where(and(eq(deliveryOrders.tenantId, tenantIdToUse as number), gte(deliveryOrders.createdAt, startDate)))
        .groupBy(deliveryOrders.status);
      }
      
      const statusDistribution = await statusQuery;

      // 2. Deliveries Per Day (Area/Line Chart)
      let dailyQuery = tx.select({
        date: sql<string>`DATE(${deliveryOrders.createdAt})::text`,
        count: sql<number>`count(*)::int`
      }).from(deliveryOrders)
      .where(gte(deliveryOrders.createdAt, startDate))
      .groupBy(sql`DATE(${deliveryOrders.createdAt})`)
      .orderBy(sql`DATE(${deliveryOrders.createdAt})`);

      if (tenantIdToUse) {
         dailyQuery = tx.select({
          date: sql<string>`DATE(${deliveryOrders.createdAt})::text`,
          count: sql<number>`count(*)::int`
        }).from(deliveryOrders)
        .where(and(eq(deliveryOrders.tenantId, tenantIdToUse as number), gte(deliveryOrders.createdAt, startDate)))
        .groupBy(sql`DATE(${deliveryOrders.createdAt})`)
        .orderBy(sql`DATE(${deliveryOrders.createdAt})`);
      }

      const deliveriesPerDay = await dailyQuery;

      // 3. Inventory Stock In vs Out (Bar Chart) - Business Owners Only
      let inventoryMovement: any[] = [];
      if (tenantIdToUse) {
        inventoryMovement = await tx.select({
          date: sql<string>`DATE(${inventoryTransactions.createdAt})::text`,
          type: inventoryTransactions.transactionType,
          total: sql<number>`sum(${inventoryTransactions.quantity})::int`
        }).from(inventoryTransactions)
        .where(and(eq(inventoryTransactions.tenantId, tenantIdToUse as number), gte(inventoryTransactions.createdAt, startDate)))
        .groupBy(sql`DATE(${inventoryTransactions.createdAt})`, inventoryTransactions.transactionType)
        .orderBy(sql`DATE(${inventoryTransactions.createdAt})`);
      }

      return NextResponse.json({
        data: {
          statusDistribution,
          deliveriesPerDay,
          inventoryMovement
        }
      });
    } catch (error) {
      console.error('Aggregation error:', error);
      return NextResponse.json({ error: 'Failed to aggregate data' }, { status: 500 });
    }
  });
}
