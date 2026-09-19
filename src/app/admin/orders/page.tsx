import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, products, productVariants, customers } from '@/db/schema';
import { eq, desc, inArray, isNotNull, and } from 'drizzle-orm';
import OrdersClient from './OrdersClient';

export const metadata = {
  title: 'Customer Orders | GET Delivery Business',
};

export default async function AdminOrdersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) redirect('/login');

  const claims = await verifyToken(token);
  if (!claims) redirect('/login');

  const tenantId = claims.tenantId as number | null;
  if (!tenantId) redirect('/login');

  // Fetch all orders for this tenant
  const data = await db
    .select()
    .from(deliveryOrders)
    .where(and(
      eq(deliveryOrders.tenantId, tenantId),
      eq(deliveryOrders.orderSource, 'MARKETPLACE')
    ))
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
        unitPrice: deliveryItems.unitPrice,
        quota: productVariants.quota,
      })
      .from(deliveryItems)
      .leftJoin(productVariants, eq(deliveryItems.variantId, productVariants.id))
      .where(inArray(deliveryItems.deliveryOrderId, orderIds));
  }

  const enriched = data.map(order => ({
    ...order,
    products: items.filter(i => i.deliveryOrderId === order.id),
  }));

  return <OrdersClient initialOrders={enriched} />;
}
