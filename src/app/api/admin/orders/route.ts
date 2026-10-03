import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, products, productVariants, productSellingUnits } from '@/db/schema';
import { eq, desc, inArray, isNotNull, and, sql } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);

    if (!claims || !claims.tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant ID' }, { status: 403 });
    }
    const tenantId = claims.tenantId as number;

    const data = await db
      .select()
      .from(deliveryOrders)
      .where(eq(deliveryOrders.tenantId, tenantId))
      .orderBy(desc(deliveryOrders.createdAt));

    const orderIds = data.map(o => o.id);
    let items: any[] = [];

    if (orderIds.length > 0) {
      items = await db
        .select({
          itemId: deliveryItems.id,
          deliveryOrderId: deliveryItems.deliveryOrderId,
          productId: deliveryItems.productId,
          variantId: deliveryItems.variantId,
          variantName: productVariants.name,
          productName: deliveryItems.productName,
          quantity: deliveryItems.quantity,
          unitPrice: deliveryItems.unitPrice,
          unit: deliveryItems.unit,
          quota: productVariants.quota,
          equivalentQty: productSellingUnits.equivalentQty
        })
        .from(deliveryItems)
        .leftJoin(productVariants, eq(deliveryItems.variantId, productVariants.id))
        .leftJoin(productSellingUnits, sql`${productSellingUnits.productId} = ${deliveryItems.productId} AND (${productSellingUnits.variantId} IS NULL OR ${productSellingUnits.variantId} = ${deliveryItems.variantId}) AND TRIM(${productSellingUnits.unitName}) ILIKE TRIM(${deliveryItems.unit})`)
        .where(inArray(deliveryItems.deliveryOrderId, orderIds));
    }

    const enriched = data.map((order) => ({
      ...order,
      products: items.filter(i => i.deliveryOrderId === order.id)
    }));

    return NextResponse.json({
      success: true,
      data: enriched,
    });
  } catch (error: any) {
    console.error('Error fetching admin orders:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
