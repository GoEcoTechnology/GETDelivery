import { NextResponse } from 'next/server';
import { products } from '@/db/schema';
import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => {
    // Role is already validated by withAuth, so we just extract search params

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;

    // RLS handles the tenant isolation, but we can still provide basic WHERE clauses for efficiency
    let conditions: any = undefined;
    
    if (claims.role !== 'PLATFORM_OWNER') {
      conditions = eq(products.tenantId, claims.tenantId as number);
    }
    
    if (search) {
      const searchCond = ilike(products.name, `%${search}%`);
      conditions = conditions ? and(conditions, searchCond) : searchCond;
    }

    const data = await tx
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        category: products.category,
        price: products.price,
        stock: products.stock,
        unit: products.unit,
        lowStockThreshold: products.lowStockThreshold,
        status: products.status,
        createdAt: products.createdAt,
      })
      .from(products)
      .where(conditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(products.createdAt));

    // Get total count for pagination
    const countResult = await tx
      .select({ count: sql`count(*)` })
      .from(products)
      .where(conditions);
      
    const totalCount = Number(countResult[0]?.count || 0);

    return NextResponse.json({ data, page, limit, totalCount });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.create'] }, async (tx, claims) => {

    const body = await request.json();
    const { name, sku, barcode, category, unit, price, lowStockThreshold, productType } = body;

    if (!name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' && body.tenantId 
      ? body.tenantId 
      : claims.tenantId;

    const [newProduct] = await tx.insert(products).values({
      tenantId: tenantIdToUse,
      name,
      sku,
      barcode,
      category,
      unit,
      price: price ? price.toString() : null,
      stock: 0,
      lowStockThreshold: lowStockThreshold || 0,
      productType,
      status: 'ACTIVE',
    }).returning();

    return NextResponse.json({ data: newProduct }, { status: 201 });
  });
}
