import { NextResponse } from 'next/server';
import { db, withRLS } from '@/db';
import { deliveryOrders, deliveryItems, products } from '@/db/schema';
import { verifyToken } from '@/lib/auth';
import { eq, inArray } from 'drizzle-orm';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const authHeader = request.headers.get('authorization');
  const claims = await verifyToken(authHeader || '');
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return await withRLS(claims, async (tx) => {
      const [order] = await tx
        .select()
        .from(deliveryOrders)
        .where(eq(deliveryOrders.id, id));

      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

      const items = await tx
        .select()
        .from(deliveryItems)
        .where(eq(deliveryItems.deliveryOrderId, id));

      return NextResponse.json({ data: { ...order, items } });
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const authHeader = request.headers.get('authorization');
  const claims = await verifyToken(authHeader || '');
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Must provide at least one item' }, { status: 400 });
    }

    return await withRLS(claims, async (tx) => {
      // 1. Verify order exists and is in DRAFT status
      const [order] = await tx
        .select()
        .from(deliveryOrders)
        .where(eq(deliveryOrders.id, id));
        
      if (!order) throw new Error('Order not found');
      if (order.status !== 'DRAFT') throw new Error('Only DRAFT orders can be updated');

      // 2. Validate and fetch products
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

      // 3. Prepare items and check availability
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

      // 4. Delete old items and insert new ones
      await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryOrderId, order.id));
      await tx.insert(deliveryItems).values(itemsToInsert);

      return NextResponse.json({ data: order });
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
