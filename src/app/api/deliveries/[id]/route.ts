import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, products } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, id),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const items = await tx
      .select()
      .from(deliveryItems)
      .where(eq(deliveryItems.deliveryOrderId, id));

    return NextResponse.json({ data: { ...order, items } });
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Must provide at least one item' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    // 1. Verify order exists and is in DRAFT status
    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, id),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));
      
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== 'DRAFT') return NextResponse.json({ error: 'Only DRAFT orders can be updated' }, { status: 400 });

    // 2. Validate and fetch products
    const productIdsToFetch = items
      .map((item: any) => parseInt(item.productId, 10))
      .filter((id: number) => !isNaN(id));

    let productsStockMap = new Map<number, number>();
    if (productIdsToFetch.length > 0) {
      const fetchedProducts = await tx
        .select({ id: products.id, stock: products.stock })
        .from(products)
        .where(and(
          inArray(products.id, productIdsToFetch),
          eq(products.tenantId, tenantIdToUse)
        ));
      
      fetchedProducts.forEach((p: any) => productsStockMap.set(p.id, p.stock));
    }

    // 3. Prepare items and check availability
    const itemsToInsert = [];
    for (const item of items) {
      const productId = parseInt(item.productId, 10);
      const quantity = parseInt(item.quantity, 10);
      
      if (isNaN(productId) || isNaN(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Invalid item data' }, { status: 400 });
      }

      const availableStock = productsStockMap.get(productId);

      if (availableStock === undefined || availableStock < quantity) {
        return NextResponse.json({ error: `Insufficient stock for product ID ${productId}` }, { status: 400 });
      }

      itemsToInsert.push({
        deliveryOrderId: order.id,
        productId,
        quantity,
        unit: String(item.unit || '').trim(),
      });
    }

    // 4. Delete old items and insert new ones
    await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryOrderId, order.id));
    await tx.insert(deliveryItems).values(itemsToInsert);

    return NextResponse.json({ data: order });
  });
}
