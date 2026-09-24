import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DeliveriesClient from './DeliveriesClient';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, products, productVariants, quotaAccumulations, deliveryPartners, deliveryBatches, deliveryBatchItems, customers, deliveryAssignments } from '@/db/schema';
import { eq, desc, inArray, and } from 'drizzle-orm';

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
  let initialData: { data: any[]; batches: any[]; page: number; limit: number; totalCount: number } = { data: [], batches: [], page: 1, limit: 7, totalCount: 0 };

  if (tenantId) {
    const data = await db
      .select({
        id: deliveryOrders.id,
        tenantId: deliveryOrders.tenantId,
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
        orderSource: deliveryOrders.orderSource,
      })
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.tenantId, tenantId),
        eq(deliveryOrders.orderSource, 'CREATED')
      ))
      .orderBy(desc(deliveryOrders.createdAt))
      .limit(20);

    // Fetch Completed Batches (Marketplace Deliveries)
    const batchesData = await db
      .select({
        id: deliveryBatches.id,
        tenantId: deliveryBatches.tenantId,
        batchNumber: deliveryBatches.batchNumber,
        totalQuantity: deliveryBatches.totalQuantity,
        quotaQuantity: deliveryBatches.quotaQuantity,
        totalWeight: deliveryBatches.totalWeight,
        pickupLocation: deliveryBatches.pickupLocation,
        status: deliveryBatches.status,
        createdAt: deliveryBatches.createdAt,
        variantName: productVariants.name,
        productName: products.name,
        variantPrice: productVariants.price,
      })
      .from(deliveryBatches)
      .leftJoin(productVariants, eq(deliveryBatches.variantId, productVariants.id))
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(eq(deliveryBatches.tenantId, tenantId))
      .orderBy(desc(deliveryBatches.createdAt));
      
    const batchIds = batchesData.map(b => b.id);
    let allBatchItems: any[] = [];
    if (batchIds.length > 0) {
      allBatchItems = await db
        .select({
          id: deliveryBatchItems.id,
          batchId: deliveryBatchItems.batchId,
          quantity: deliveryBatchItems.quantity,
          customerWeight: deliveryBatchItems.customerWeight,
          customerName: customers.name,
          customerContact: customers.mobileNumber,
          dropoffAddress: deliveryOrders.dropoffAddress,
          partnerDriverName: deliveryOrders.partnerDriverName,
          partnerDriverContact: deliveryOrders.partnerDriverContact,
          finalDeliveryPrice: deliveryOrders.finalDeliveryPrice,
          offeredAmount: deliveryOrders.offeredAmount,
          deliveryPriority: deliveryOrders.deliveryPriority,
          deliveryDate: deliveryOrders.deliveryDate,
        })
        .from(deliveryBatchItems)
        .leftJoin(customers, eq(deliveryBatchItems.customerId, customers.id))
        .leftJoin(deliveryOrders, eq(deliveryBatchItems.customerOrderId, deliveryOrders.id))
        .where(inArray(deliveryBatchItems.batchId, batchIds));
    }
    
    const enrichedBatches = batchesData.map(batch => {
      const items = allBatchItems.filter(item => item.batchId === batch.id);
      return {
        ...batch,
        items,
        partnerDriverName: items.find(i => i.partnerDriverName)?.partnerDriverName || null,
        partnerDriverContact: items.find(i => i.partnerDriverContact)?.partnerDriverContact || null,
      };
    });

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
          variantName: productVariants.name,
          unit: deliveryItems.unit,
          quantity: deliveryItems.quantity,
          unitPrice: productVariants.price
        })
        .from(deliveryItems)
        .innerJoin(products, eq(deliveryItems.productId, products.id))
        .leftJoin(productVariants, eq(deliveryItems.variantId, productVariants.id))
        .where(inArray(deliveryItems.deliveryOrderId, orderIds));

      const assignments = await db
        .select({
          deliveryOrderId: deliveryAssignments.deliveryOrderId,
          driverName: deliveryAssignments.driverName,
          vehicleDetails: deliveryAssignments.vehicleDetails,
        })
        .from(deliveryAssignments)
        .where(inArray(deliveryAssignments.deliveryOrderId, orderIds));
      
      const assignmentMap = new Map();
      assignments.forEach((a) => assignmentMap.set(a.deliveryOrderId, a));

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
              targetQuantity: order.quota,
              quotaStatus: accQty >= order.quota ? 'REACHED' : 'IN_PROGRESS'
            };
          }),
        temporaryWinner: order.temporaryWinnerId ? (winnerMap.get(order.temporaryWinnerId) || null) : null,
        internalAssignment: !order.temporaryWinnerId ? (assignmentMap.get(order.id) || null) : null
      }));

      initialData = { data: enriched, batches: enrichedBatches, page: 1, limit: 7, totalCount };
    } else {
      initialData = { data: [], batches: enrichedBatches, page: 1, limit: 7, totalCount: 0 };
    }
  }

  return <DeliveriesClient initialData={initialData} />;
}
