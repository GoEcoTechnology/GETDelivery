import { NextResponse } from 'next/server';
import { deliveryOrders, deliveryItems, products, productVariants } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.view'] }, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const tenantIdToUse = claims.tenantId as number;

    const subOrders = await tx
      .select({
        id: deliveryOrders.id,
        customerName: deliveryOrders.customerName,
        customerContact: deliveryOrders.customerContact,
        address: deliveryOrders.dropoffAddress,
        landmark: deliveryOrders.instructions,
        createdAt: deliveryOrders.createdAt,
      })
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.tenantId, tenantIdToUse),
        eq(deliveryOrders.parentOrderId, id)
      ));

    const subOrderIds = subOrders.map((o: any) => o.id);
    const data = subOrders.map((o: any) => ({ ...o, items: [] as any[] }));

    if (subOrderIds.length > 0) {
      const items = await tx
        .select({
          deliveryOrderId: deliveryItems.deliveryOrderId,
          quantity: deliveryItems.quantity,
          unit: deliveryItems.unit,
          productName: products.name,
          variantName: productVariants.name,
        })
        .from(deliveryItems)
        .innerJoin(products, eq(deliveryItems.productId, products.id))
        .leftJoin(productVariants, eq(deliveryItems.variantId, productVariants.id))
        .where(inArray(deliveryItems.deliveryOrderId, subOrderIds));
        
      for (const item of items) {
        const order = data.find((o: any) => o.id === item.deliveryOrderId);
        if (order) {
          order.items.push(item);
        }
      }
    }

    return NextResponse.json({ data });
  });
}
