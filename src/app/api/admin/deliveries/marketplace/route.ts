import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryBatches, deliveryBatchItems, productVariants, products, customers, deliveryOrders, deliveryItems } from '@/db/schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';
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
    let allDeliveryItems: any[] = [];

    if (batchIds.length > 0) {
      allBatchItems = await db
        .select({
          id: deliveryBatchItems.id,
          batchId: deliveryBatchItems.batchId,
          customerOrderId: deliveryBatchItems.customerOrderId,
          quantity: deliveryBatchItems.quantity,
          customerWeight: deliveryBatchItems.customerWeight,
          customerName: customers.name,
          customerContact: customers.mobileNumber,
          dropoffAddress: deliveryOrders.dropoffAddress,
          partnerDriverName: deliveryOrders.partnerDriverName,
          partnerDriverContact: deliveryOrders.partnerDriverContact,
          finalDeliveryPrice: deliveryOrders.finalDeliveryPrice,
          offeredAmount: deliveryOrders.offeredAmount,
          normalDeliveryFee: deliveryOrders.normalDeliveryFee,
          urgentAdditionalFee: deliveryOrders.urgentAdditionalFee,
          deliveryPriority: deliveryOrders.deliveryPriority,
          deliveryDate: deliveryOrders.deliveryDate,
          orderStatus: deliveryOrders.status,
          routeDistance: deliveryOrders.routeDistance,
          distanceKm: deliveryOrders.distanceKm
        })
        .from(deliveryBatchItems)
        .leftJoin(customers, eq(deliveryBatchItems.customerId, customers.id))
        .leftJoin(deliveryOrders, eq(deliveryBatchItems.customerOrderId, deliveryOrders.id))
        .where(inArray(deliveryBatchItems.batchId, batchIds));

      const orderIds = Array.from(new Set(allBatchItems.map(i => i.customerOrderId).filter(id => id)));
      if (orderIds.length > 0) {
        allDeliveryItems = await db
          .select({
            itemId: deliveryItems.id,
            deliveryOrderId: deliveryItems.deliveryOrderId,
            productName: sql<string>`COALESCE(${deliveryItems.productName}, ${products.name})`.as('productName'),
            variantName: productVariants.name,
            quantity: deliveryItems.quantity,
            unitPrice: deliveryItems.unitPrice,
            unit: deliveryItems.unit,
          })
          .from(deliveryItems)
          .leftJoin(products, eq(deliveryItems.productId, products.id))
          .leftJoin(productVariants, eq(deliveryItems.variantId, productVariants.id))
          .where(inArray(deliveryItems.deliveryOrderId, orderIds));
      }
    }

    const enrichedBatches = batchesData.map(batch => {
      const items = allBatchItems.filter(item => item.batchId === batch.id).map(item => ({
        ...item,
        products: allDeliveryItems.filter(i => Number(i.deliveryOrderId) === Number(item.customerOrderId))
      }));
      return {
        ...batch,
        items,
        partnerDriverName: items.find(i => i.partnerDriverName)?.partnerDriverName || null,
        partnerDriverContact: items.find(i => i.partnerDriverContact)?.partnerDriverContact || null,
      };
    });

    return NextResponse.json(enrichedBatches);
  } catch (error: any) {
    console.error('Error fetching marketplace batches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
