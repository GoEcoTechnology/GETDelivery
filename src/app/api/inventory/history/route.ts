import { NextResponse } from 'next/server';
import { db } from '@/db';
import { inventoryTransactions, products, users } from '@/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    
    const offset = (page - 1) * limit;

    let conditions: any = undefined;
    if (claims.role !== 'PLATFORM_OWNER') {
      conditions = eq(inventoryTransactions.tenantId, claims.tenantId as number);
    }

    // Join with products and users to get names
    const data = await tx
      .select({
        id: inventoryTransactions.id,
        productName: products.name,
        sku: products.sku,
        quantity: inventoryTransactions.quantity,
        previousStock: inventoryTransactions.previousStock,
        newStock: inventoryTransactions.newStock,
        transactionType: inventoryTransactions.transactionType,
        reference: inventoryTransactions.reference,
        createdAt: inventoryTransactions.createdAt,
        performedByName: users.name
      })
      .from(inventoryTransactions)
      .leftJoin(products, eq(inventoryTransactions.productId, products.id))
      .leftJoin(users, eq(inventoryTransactions.performedBy, users.id))
      .where(conditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(inventoryTransactions.createdAt));

    const countResult = await tx
      .select({ count: sql`count(*)` })
      .from(inventoryTransactions)
      .where(conditions);
      
    const totalCount = Number(countResult[0]?.count || 0);

    return NextResponse.json({ data, page, limit, totalCount });
  });
}
