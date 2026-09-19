import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import BatchesClient from './BatchesClient'; // trigger ts
import { db } from '@/db';
import { deliveryBatches, deliveryBatchItems, productVariants, products, deliveryOrders } from '@/db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';

export const metadata = {
  title: 'Delivery Batches | GET Delivery Business',
};

export default async function AdminBatchesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) redirect('/login');

  const claims = await verifyToken(token);
  if (!claims) redirect('/login');

  const tenantId = claims.tenantId as number | null;
  if (!tenantId) redirect('/login');

  // Fetch batches for this tenant
  const batchesData = await db
    .select({
      id: deliveryBatches.id,
      batchNumber: deliveryBatches.batchNumber,
      totalQuantity: deliveryBatches.totalQuantity,
      quotaQuantity: deliveryBatches.quotaQuantity,
      totalWeight: deliveryBatches.totalWeight,
      pickupLocation: deliveryBatches.pickupLocation,
      status: deliveryBatches.status,
      createdAt: deliveryBatches.createdAt,
      variantName: productVariants.name,
      productName: products.name,
    })
    .from(deliveryBatches)
    .innerJoin(productVariants, eq(deliveryBatches.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(deliveryBatches.tenantId, tenantId))
    .orderBy(desc(deliveryBatches.createdAt));

  const batchIds = batchesData.map(b => b.id);
  let batchItems: any[] = [];

  if (batchIds.length > 0) {
    batchItems = await db
      .select({
        id: deliveryBatchItems.id,
        batchId: deliveryBatchItems.batchId,
        quantity: deliveryBatchItems.quantity,
        customerWeight: deliveryBatchItems.customerWeight,
        customerName: deliveryOrders.customerName,
        customerContact: deliveryOrders.customerContact,
        dropoffAddress: deliveryOrders.dropoffAddress,
      })
      .from(deliveryBatchItems)
      .innerJoin(deliveryOrders, eq(deliveryBatchItems.customerOrderId, deliveryOrders.id))
      .where(inArray(deliveryBatchItems.batchId, batchIds));
  }

  const enriched = batchesData.map(batch => ({
    ...batch,
    items: batchItems.filter(i => i.batchId === batch.id),
  }));

  return <BatchesClient initialBatches={enriched} />;
}
