import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, inventoryTransactions } from '@/db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(req: Request) {
  return withAuth(req, async (tx, claims) => {
    try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'month';
    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;

    const now = new Date();
    let startDate = new Date();
    if (range === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (range === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (range === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    let statusQuery = db.select({
      status: deliveryOrders.status,
      value: sql<number>`count(*)::int`
    }).from(deliveryOrders)
    .where(gte(deliveryOrders.createdAt, startDate))
    .groupBy(deliveryOrders.status);

    if (tenantIdToUse) {
      statusQuery = db.select({
        status: deliveryOrders.status,
        value: sql<number>`count(*)::int`
      }).from(deliveryOrders)
      .where(and(eq(deliveryOrders.tenantId, tenantIdToUse as number), gte(deliveryOrders.createdAt, startDate)))
      .groupBy(deliveryOrders.status);
    }
    
    let dailyQuery = db.select({
      date: sql<string>`DATE(${deliveryOrders.createdAt})::text`,
      count: sql<number>`count(*)::int`
    }).from(deliveryOrders)
    .where(gte(deliveryOrders.createdAt, startDate))
    .groupBy(sql`DATE(${deliveryOrders.createdAt})`)
    .orderBy(sql`DATE(${deliveryOrders.createdAt})`);

    if (tenantIdToUse) {
        dailyQuery = db.select({
        date: sql<string>`DATE(${deliveryOrders.createdAt})::text`,
        count: sql<number>`count(*)::int`
      }).from(deliveryOrders)
      .where(and(eq(deliveryOrders.tenantId, tenantIdToUse as number), gte(deliveryOrders.createdAt, startDate)))
      .groupBy(sql`DATE(${deliveryOrders.createdAt})`)
      .orderBy(sql`DATE(${deliveryOrders.createdAt})`);
    }

    let inventoryQuery = db.select({
      date: sql<string>`DATE(${inventoryTransactions.createdAt})::text`,
      type: inventoryTransactions.transactionType,
      total: sql<number>`sum(${inventoryTransactions.quantity})::int`
    }).from(inventoryTransactions)
    .where(gte(inventoryTransactions.createdAt, startDate))
    .groupBy(sql`DATE(${inventoryTransactions.createdAt})`, inventoryTransactions.transactionType)
    .orderBy(sql`DATE(${inventoryTransactions.createdAt})`);

    if (tenantIdToUse) {
      inventoryQuery = db.select({
        date: sql<string>`DATE(${inventoryTransactions.createdAt})::text`,
        type: inventoryTransactions.transactionType,
        total: sql<number>`sum(${inventoryTransactions.quantity})::int`
      }).from(inventoryTransactions)
      .where(and(eq(inventoryTransactions.tenantId, tenantIdToUse as number), gte(inventoryTransactions.createdAt, startDate)))
      .groupBy(sql`DATE(${inventoryTransactions.createdAt})`, inventoryTransactions.transactionType)
      .orderBy(sql`DATE(${inventoryTransactions.createdAt})`);
    }

    const [statusDistributionRaw, deliveriesPerDay, inventoryMovement] = await Promise.all([
      statusQuery,
      dailyQuery,
      inventoryQuery
    ]);

    const statusDistribution = statusDistributionRaw.map((s: any) => ({
      name: s.status,
      value: s.value
    }));

    const chartData = {
      statusDistribution,
      deliveriesPerDay,
      inventoryMovement
    };

    return NextResponse.json(chartData);
    } catch (error) {
      console.error('Failed to fetch dashboard charts:', error);
      return NextResponse.json({ error: 'Failed to fetch charts' }, { status: 500 });
    }
  });
}
