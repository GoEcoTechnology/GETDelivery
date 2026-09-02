import { NextResponse } from 'next/server';
import { db } from '@/db';
import { stockOuts, products, users } from '@/db/schema';
import { eq, and, sql, desc, gte, lte, ilike, or } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const search = url.searchParams.get('search') || '';
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId) as number;
    if (!tenantIdToUse) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const conditions = [eq(stockOuts.tenantId, tenantIdToUse)];

    if (search) {
      conditions.push(
        or(
          ilike(stockOuts.referenceNumber, `%${search}%`),
          ilike(stockOuts.reason, `%${search}%`)
        )!
      );
    }

    if (startDate) {
      conditions.push(gte(stockOuts.createdAt, new Date(startDate)));
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(stockOuts.createdAt, end));
    }

    // Get unique reference numbers (pagination based on distinct transactions)
    const distinctTx = await tx
      .select({
        referenceNumber: stockOuts.referenceNumber,
      })
      .from(stockOuts)
      .where(and(...conditions))
      .groupBy(stockOuts.referenceNumber, stockOuts.createdAt)
      .orderBy(desc(stockOuts.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await tx
      .select({ count: sql`count(distinct ${stockOuts.referenceNumber})`.mapWith(Number) })
      .from(stockOuts)
      .where(and(...conditions));
    
    const totalCount = countResult[0].count;

    if (distinctTx.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { total: totalCount, limit, offset }
      });
    }

    const references = distinctTx.map((t: any) => t.referenceNumber);

    // Get all items for these transactions
    const rawData = await tx
      .select({
        id: stockOuts.id,
        referenceNumber: stockOuts.referenceNumber,
        productName: products.name,
        category: products.category,
        quantity: stockOuts.quantity,
        reason: stockOuts.reason,
        notes: stockOuts.notes,
        employeeName: users.name,
        createdAt: stockOuts.createdAt,
        status: stockOuts.status
      })
      .from(stockOuts)
      .leftJoin(products, eq(stockOuts.productId, products.id))
      .leftJoin(users, eq(stockOuts.performedBy, users.id))
      .where(sql`${stockOuts.referenceNumber} IN (${sql.join(references, sql`, `)})`)
      .orderBy(desc(stockOuts.createdAt));

    // Group items by reference number
    const groupedData = new Map();
    
    for (const row of rawData) {
      if (!groupedData.has(row.referenceNumber)) {
        groupedData.set(row.referenceNumber, {
          referenceNumber: row.referenceNumber,
          createdAt: row.createdAt,
          employeeName: row.employeeName,
          reason: row.reason,
          status: row.status,
          totalQuantity: 0,
          totalProducts: 0,
          items: []
        });
      }
      
      const group = groupedData.get(row.referenceNumber);
      group.totalQuantity += row.quantity;
      group.totalProducts += 1;
      group.items.push({
        id: row.id,
        productName: row.productName,
        category: row.category,
        quantity: row.quantity,
        notes: row.notes
      });
    }

    const data = Array.from(groupedData.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({
      data,
      pagination: {
        total: totalCount,
        limit,
        offset
      }
    });
  });
}
