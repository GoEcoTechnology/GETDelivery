import { NextResponse } from 'next/server';
import { db } from '@/db';
import { inventoryTransactions, products } from '@/db/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => {
    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId) as number;
    if (!tenantIdToUse) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const todayResult = await tx
      .select({ count: sql`SUM(${inventoryTransactions.quantity})`.mapWith(Number) })
      .from(inventoryTransactions)
      .where(and(eq(inventoryTransactions.tenantId, tenantIdToUse), gte(inventoryTransactions.createdAt, today), eq(inventoryTransactions.transactionType, 'OUT')));

    const weekResult = await tx
      .select({ count: sql`SUM(${inventoryTransactions.quantity})`.mapWith(Number) })
      .from(inventoryTransactions)
      .where(and(eq(inventoryTransactions.tenantId, tenantIdToUse), gte(inventoryTransactions.createdAt, startOfWeek), eq(inventoryTransactions.transactionType, 'OUT')));

    const monthResult = await tx
      .select({ count: sql`SUM(${inventoryTransactions.quantity})`.mapWith(Number) })
      .from(inventoryTransactions)
      .where(and(eq(inventoryTransactions.tenantId, tenantIdToUse), gte(inventoryTransactions.createdAt, startOfMonth), eq(inventoryTransactions.transactionType, 'OUT')));

    // Stock Out by Reason (all time or current month)
    // Group by reference text as a proxy for reason (if provided)
    const reasonResult = await tx
      .select({
        reason: inventoryTransactions.reference,
        count: sql`SUM(${inventoryTransactions.quantity})`.mapWith(Number)
      })
      .from(inventoryTransactions)
      .where(and(eq(inventoryTransactions.tenantId, tenantIdToUse), eq(inventoryTransactions.transactionType, 'OUT')))
      .groupBy(inventoryTransactions.reference);

    // Most Stocked Out Products
    const topProductsResult = await tx
      .select({
        productName: products.name,
        count: sql`SUM(${inventoryTransactions.quantity})`.mapWith(Number)
      })
      .from(inventoryTransactions)
      .leftJoin(products, eq(inventoryTransactions.productId, products.id))
      .where(and(eq(inventoryTransactions.tenantId, tenantIdToUse), eq(inventoryTransactions.transactionType, 'OUT')))
      .groupBy(products.name)
      .orderBy(sql`SUM(${inventoryTransactions.quantity}) DESC`)
      .limit(5);

    return NextResponse.json({
      todayCount: todayResult[0]?.count || 0,
      weekCount: weekResult[0]?.count || 0,
      monthCount: monthResult[0]?.count || 0,
      reasons: reasonResult,
      topProducts: topProductsResult
    });
  });
}
