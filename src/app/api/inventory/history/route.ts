import { NextResponse } from 'next/server';
import { db } from '@/db';
import { inventoryTransactions, products, users } from '@/db/schema';
import { desc, eq, and, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { purgeExpiredDeliveries } from '@/lib/delivery-purge';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => {
    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : (claims.tenantId as number | null | undefined);

    // Auto-purge records older than 1 month (30 days)
    await purgeExpiredDeliveries(tenantIdToUse).catch(err => {
      console.error('Error during auto-purge in inventory-history route:', err);
    });

    const { searchParams } = new URL(request.url);
    const isExport = searchParams.get('all') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = isExport ? 5000 : parseInt(searchParams.get('limit') || '25', 10);
    const offset = isExport ? 0 : (page - 1) * limit;

    let conditions: any = undefined;
    if (claims.role !== 'PLATFORM_OWNER') {
      conditions = eq(inventoryTransactions.tenantId, claims.tenantId as number);
    }

    // Join with products and users to get names
    const query = tx
      .select({
        id: inventoryTransactions.id,
        productName: products.name,
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

    const data = await query;

    const countResult = await tx
      .select({ count: sql`count(*)` })
      .from(inventoryTransactions)
      .where(conditions);
      
    const totalCount = Number(countResult[0]?.count || 0);

    const formattedData = data.map((item: any) => {
      let ref = item.reference || '—';
      if (ref.startsWith('Delivery Order SO-') || ref.startsWith('DISPATCH-BATCH-') || ref === 'Delivery Order') {
        ref = 'Delivery Order';
      } else if (ref.startsWith('STO-')) {
        ref = 'Manual Stock Out';
      } else if (ref.startsWith('STIN-')) {
        ref = 'Manual Stock In';
      }
      return { ...item, reference: ref };
    });

    return NextResponse.json({ data: formattedData, page, limit, totalCount });
  });
}
