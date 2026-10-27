import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, products, productVariants, productSellingUnits, customers } from '@/db/schema';
import { eq, desc, inArray, isNotNull, and, sql } from 'drizzle-orm';
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
  const isPlatformOwner = claims.role === 'PLATFORM_OWNER';
  if (!tenantId && !isPlatformOwner) redirect('/login');

  // Fetch orders for this tenant (or all orders if platform owner)
  const data = await db
    .select()
    .from(deliveryOrders)
    .where(tenantId ? eq(deliveryOrders.tenantId, tenantId) : undefined)
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
        weightKg: deliveryItems.weightKg,
        quota: productVariants.quota,
        equivalentQty: productSellingUnits.equivalentQty,
      })
      .from(deliveryItems)
      .leftJoin(productVariants, eq(deliveryItems.variantId, productVariants.id))
      .leftJoin(
        productSellingUnits,
        sql`${productSellingUnits.productId} = ${deliveryItems.productId} AND (${productSellingUnits.variantId} IS NULL OR ${productSellingUnits.variantId} = ${deliveryItems.variantId}) AND TRIM(${productSellingUnits.unitName}) ILIKE TRIM(${deliveryItems.unit})`
      )
      .where(inArray(deliveryItems.deliveryOrderId, orderIds));
  }

  const enriched = data.map(order => ({
    ...order,
    products: items.filter(i => i.deliveryOrderId === order.id),
  }));

  return <OrdersClient initialOrders={enriched} />;
}
