import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DeliveriesClient from './DeliveriesClient';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, products, quotaAccumulations, deliveryPartners } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

export default async function DeliveriesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const claims = await verifyToken(token);
  if (!claims) {
    redirect('/login');
  }

  const tenantId = claims.tenantId as number | null;
  let initialData: { data: any[]; page: number; limit: number; totalCount: number } = { data: [], page: 1, limit: 7, totalCount: 0 };

  if (tenantId) {
    const data = await db
      .select({
        id: deliveryOrders.id,
        customerName: deliveryOrders.customerName,
        customerContact: deliveryOrders.customerContact,
        pickupAddress: deliveryOrders.pickupAddress,
        dropoffAddress: deliveryOrders.dropoffAddress,
        status: deliveryOrders.status,
        batchId: deliveryOrders.batchId,
        quota: deliveryOrders.quota,
        temporaryWinnerId: deliveryOrders.temporaryWinnerId,
        requiredVehicleType: deliveryOrders.requiredVehicleType,
        finalDeliveryPrice: deliveryOrders.finalDeliveryPrice,
        partnerDriverName: deliveryOrders.partnerDriverName,
        partnerDriverContact: deliveryOrders.partnerDriverContact,
        deliveryDate: deliveryOrders.deliveryDate,
        createdAt: deliveryOrders.createdAt,
      })
      .from(deliveryOrders)
      .where(eq(deliveryOrders.tenantId, tenantId))
      .orderBy(desc(deliveryOrders.createdAt))
      .limit(7);

    const totalCount = data.length;
    const orderIds = data.map((o) => o.id);
    if (orderIds.length > 0) {
      const winnerIds = data
        .map((o) => o.temporaryWinnerId)
        .filter((id): id is number => typeof id === 'number');

      const winners = winnerIds.length > 0 ? await db
        .select({
          id: deliveryPartners.id,
          companyName: deliveryPartners.companyName,
          contactPerson: deliveryPartners.contactPerson,
          mobileNumber: deliveryPartners.mobileNumber,
          email: deliveryPartners.email,
        })
        .from(deliveryPartners)
        .where(inArray(deliveryPartners.id, winnerIds)) : [];

      const winnerMap = new Map<number, (typeof winners)[number]>();
      winners.forEach((winner) => winnerMap.set(winner.id, winner));

      const items = await db
        .select({
          itemId: deliveryItems.id,
          deliveryOrderId: deliveryItems.deliveryOrderId,
          productId: products.id,
          productName: products.name,
          quantity: deliveryItems.quantity,
          unitPrice: products.price
        })
        .from(deliveryItems)
        .innerJoin(products, eq(deliveryItems.productId, products.id))
        .where(inArray(deliveryItems.deliveryOrderId, orderIds));

      const accumulations = await db
        .select({
          deliveryOrderId: quotaAccumulations.sourceOrderId,
          itemId: quotaAccumulations.sourceItemId,
          quantityAdded: quotaAccumulations.quantityAdded,
        })
        .from(quotaAccumulations)
        .where(inArray(quotaAccumulations.sourceOrderId, orderIds));

      const accMap: Record<string, number> = {};
      for (const acc of accumulations) {
        const key = `${acc.deliveryOrderId}-${acc.itemId}`;
        accMap[key] = (accMap[key] || 0) + acc.quantityAdded;
      }

      const enriched = data.map((order) => ({
        ...order,
        products: items
          .filter((i) => i.deliveryOrderId === order.id)
          .map((i) => {
            const accQty = accMap[`${order.id}-${i.itemId}`] || 0;
            return {
              ...i,
              accumulatedQuantity: accQty,
              targetQuantity: i.quantity,
              quotaStatus: accQty >= i.quantity ? 'REACHED' : 'IN_PROGRESS'
            };
          }),
        temporaryWinner: order.temporaryWinnerId ? (winnerMap.get(order.temporaryWinnerId) || null) : null
      }));

      initialData = { data: enriched, page: 1, limit: 7, totalCount };
    }
  }

  return <DeliveriesClient initialData={initialData} />;
}
