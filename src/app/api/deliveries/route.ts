import { NextResponse } from 'next/server';
import { deliveryOrders, deliveryItems, products } from '@/db/schema';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.view'] }, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const statusFilter = searchParams.get('status');
    const offset = (page - 1) * limit;

    let whereClause = eq(deliveryOrders.tenantId, claims.tenantId as number);
    if (statusFilter) {
      whereClause = and(whereClause, eq(deliveryOrders.status, statusFilter)) as any;
    }

    // RLS will enforce tenant isolation automatically
    const data = await tx
      .select({
        id: deliveryOrders.id,
        customerName: deliveryOrders.customerName,
        customerContact: deliveryOrders.customerContact,
        pickupAddress: deliveryOrders.pickupAddress,
        dropoffAddress: deliveryOrders.dropoffAddress,
        status: deliveryOrders.status,
        createdAt: deliveryOrders.createdAt,
      })
      .from(deliveryOrders)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(deliveryOrders.createdAt));

    return NextResponse.json({ data, page, limit });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.create'] }, async (tx, claims) => {
    const body = await request.json();
    
    // Mass Assignment Protection: explicitly whitelist fields
    const customerId = body.customerId ? parseInt(body.customerId, 10) : null;
    const customerName = String(body.customerName || '').trim();
    const customerContact = String(body.customerContact || '').trim();
    const pickupAddress = String(body.pickupAddress || '').trim();
    const dropoffAddress = String(body.dropoffAddress || '').trim();
    const deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
    const instructions = String(body.instructions || '').trim();
    const items = body.items;

    if (!customerName || !pickupAddress || !dropoffAddress || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing required delivery information' }, { status: 400 });
    }

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' && body.tenantId 
      ? body.tenantId 
      : claims.tenantId;

    const [order] = await tx.insert(deliveryOrders).values({
      tenantId: tenantIdToUse,
      customerId,
      customerName,
      customerContact,
      pickupAddress,
      dropoffAddress,
      deliveryDate,
      instructions,
      status: 'DRAFT',
    }).returning();

    // 1. Validate and fetch products
    const productIdsToFetch = items
      .map((item: any) => parseInt(item.productId, 10))
      .filter((id: number) => !isNaN(id));

    let productsStockMap = new Map<number, number>();
    if (productIdsToFetch.length > 0) {
      const fetchedProducts = await tx
        .select({ id: products.id, stock: products.stock })
        .from(products)
        .where(inArray(products.id, productIdsToFetch));
      
      fetchedProducts.forEach((p: any) => productsStockMap.set(p.id, p.stock));
    }

    // Validate items to prevent injection and check availability
    const itemsToInsert = [];
    for (const item of items) {
      const productId = parseInt(item.productId, 10);
      const quantity = parseInt(item.quantity, 10);
      
      if (isNaN(productId) || isNaN(quantity) || quantity <= 0) {
        throw new Error('Invalid item data');
      }

      const availableStock = productsStockMap.get(productId);

      if (availableStock === undefined || availableStock < quantity) {
        throw new Error(`Insufficient stock for product ID ${productId}`);
      }

      itemsToInsert.push({
        deliveryOrderId: order.id,
        productId,
        quantity,
        unit: String(item.unit || '').trim(),
      });
    }

    await tx.insert(deliveryItems).values(itemsToInsert);

    return NextResponse.json({ data: order }, { status: 201 });
  });
}

