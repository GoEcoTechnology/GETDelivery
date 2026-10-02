import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, products, productVariants, deliveryBatches, deliveryBatchItems, customers } from '@/db/schema';
import { eq, inArray, isNull, desc, and } from 'drizzle-orm';
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const tenantId = claims.tenantId as number;

    // Fetch all unassigned marketplace orders (batch_id is null)
    const unassignedOrdersData = await db
      .select({
        order: deliveryOrders,
        basisProduct: products,
        basisVariant: productVariants,
      })
      .from(deliveryOrders)
      .leftJoin(products, eq(deliveryOrders.basisProductId, products.id))
      .leftJoin(productVariants, eq(deliveryOrders.basisVariantId, productVariants.id))
      .where(and(
        eq(deliveryOrders.tenantId, tenantId),
        eq(deliveryOrders.orderSource, 'MARKETPLACE'),
        eq(deliveryOrders.status, 'DRAFT'), // assuming DRAFT/WAITING are valid
        isNull(deliveryOrders.batchId)
      ))
      .orderBy(desc(deliveryOrders.createdAt));

    // Fetch batches that are not yet dispatched (e.g. READY_FOR_DELIVERY)
    const batchesData = await db
      .select({
        batch: deliveryBatches,
        variant: productVariants,
        product: products,
      })
      .from(deliveryBatches)
      .innerJoin(productVariants, eq(deliveryBatches.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(
        eq(deliveryBatches.tenantId, tenantId),
        eq(deliveryBatches.status, 'READY_FOR_DELIVERY')
      ))
      .orderBy(desc(deliveryBatches.createdAt));

    // For all fetched orders (both unassigned and in batches), fetch their items
    const allOrderIds = unassignedOrdersData.map(o => o.order.id);
    
    // Fetch batch items
    const batchIds = batchesData.map(b => b.batch.id);
    let allBatchItems: any[] = [];
    if (batchIds.length > 0) {
      allBatchItems = await db
        .select({
          batchItem: deliveryBatchItems,
          order: deliveryOrders
        })
        .from(deliveryBatchItems)
        .innerJoin(deliveryOrders, eq(deliveryBatchItems.customerOrderId, deliveryOrders.id))
        .where(inArray(deliveryBatchItems.batchId, batchIds));
        
      allBatchItems.forEach(bi => {
        if (!allOrderIds.includes(bi.order.id)) {
          allOrderIds.push(bi.order.id);
        }
      });
    }

    let allItems: any[] = [];
    if (allOrderIds.length > 0) {
      allItems = await db
        .select()
        .from(deliveryItems)
        .where(inArray(deliveryItems.deliveryOrderId, allOrderIds));
    }

    // Format unassigned orders
    const unassignedOrders = unassignedOrdersData.map(row => ({
      ...row.order,
      basisProductName: row.basisProduct?.name || 'Unknown',
      basisVariantName: row.basisVariant?.name || 'Unknown',
      quota: row.basisVariant?.quota || 0,
      items: allItems.filter(i => i.deliveryOrderId === row.order.id)
    }));

    // Format batches
    const batches = batchesData.map(row => {
      const bItems = allBatchItems.filter(bi => bi.batchItem.batchId === row.batch.id);
      
      const ordersInBatch = bItems.map(bi => ({
        ...bi.order,
        items: allItems.filter(i => i.deliveryOrderId === bi.order.id)
      }));
      
      return {
        ...row.batch,
        basisProductName: row.product.name,
        basisVariantName: row.variant.name,
        orders: ordersInBatch
      };
    });

    return NextResponse.json({ success: true, unassignedOrders, batches });

  } catch (error: any) {
    console.error('API /admin/batching Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
