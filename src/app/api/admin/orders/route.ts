import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, products, productVariants} from '@/db/schema';
import { eq, desc, inArray, isNotNull, and } from 'drizzle-orm';
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
      .where(and(eq(deliveryOrders.tenantId, tenantId), isNotNull(deliveryOrders.normalDeliveryFee)))
      .orderBy(desc(deliveryOrders.createdAt));

    const orderIds = data.map(o => o.id);
    let items: any[] = [];
    
    if (orderIds.length > 0) {
      items = await db
        .select({
          itemId: deliveryItems.id,
          deliveryOrderId: deliveryItems.deliveryOrderId,
          productId: deliveryItems.productId,
          productName: deliveryItems.productName,
          quantity: deliveryItems.quantity,
          unitPrice: deliveryItems.unitPrice
        })
        .from(deliveryItems)
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
