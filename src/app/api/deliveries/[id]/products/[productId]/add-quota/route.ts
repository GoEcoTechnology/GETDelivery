import { NextResponse } from 'next/server';
import { db } from '@/db';
import { productQuotas, quotaAccumulations, deliveryOrders, deliveryItems } from '@/db/schema';
import { eq, and, sql as drizzleSql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string, productId: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.update'] }, async (tx, claims) => {
    try {
      const p = await params;
      const deliveryId = parseInt(p.id, 10);
      const productId = parseInt(p.productId, 10);
      
      const { quantity } = await request.json();
      const qtyToAdd = parseInt(quantity, 10);

      if (isNaN(deliveryId) || isNaN(productId) || isNaN(qtyToAdd) || qtyToAdd <= 0) {
        return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
      }

      const tenantIdToUse = claims.tenantId as number;

      // Ensure the delivery order exists
      const [order] = await tx.select().from(deliveryOrders).where(and(eq(deliveryOrders.id, deliveryId), eq(deliveryOrders.tenantId, tenantIdToUse)));
      if (!order) return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });

      // Fetch or create quota
      let [quota] = await tx.select().from(productQuotas).where(and(
        eq(productQuotas.tenantId, tenantIdToUse),
        eq(productQuotas.productId, productId)
      ));
      
      if (!quota) {
        [quota] = await tx.insert(productQuotas).values({
          tenantId: tenantIdToUse,
          productId: productId,
          targetQuantity: 20,
          accumulatedQuantity: 0,
        }).returning();
      }

      // Ensure we have a delivery item to link to (or grab the first one for this product in this order, or create a dummy item id - wait, schema requires sourceItemId)
      // Let's just grab the delivery item for this product in this order
      const [item] = await tx.select().from(deliveryItems).where(and(
        eq(deliveryItems.deliveryOrderId, deliveryId),
        eq(deliveryItems.productId, productId)
      ));

      if (!item) {
        return NextResponse.json({ error: 'Product not part of this delivery order' }, { status: 400 });
      }

      // Add to accumulation ledger
      await tx.insert(quotaAccumulations).values({
        tenantId: tenantIdToUse,
        productId,
        sourceOrderId: deliveryId,
        sourceItemId: item.id,
        quantityAdded: qtyToAdd
      });

      // Update product quota (global) - we keep this to not break schema constraints
      const globalAccumulated = quota.accumulatedQuantity + qtyToAdd;
      const newStatus = globalAccumulated >= quota.targetQuantity ? 'REACHED' : 'IN_PROGRESS';

      await tx.update(productQuotas)
        .set({ accumulatedQuantity: globalAccumulated, status: newStatus })
        .where(eq(productQuotas.id, quota.id));

      // Calculate the per-order accumulated quantity to return to frontend
      const [{ perOrderTotal }] = await tx
        .select({ perOrderTotal: drizzleSql<number>`SUM(${quotaAccumulations.quantityAdded})::int` })
        .from(quotaAccumulations)
        .where(and(
          eq(quotaAccumulations.sourceOrderId, deliveryId),
          eq(quotaAccumulations.productId, productId)
        ));

      // --- Auto-Ready Logic ---
      // Check if all items in this order have reached their quota
      const orderItems = await tx.select().from(deliveryItems).where(eq(deliveryItems.deliveryOrderId, deliveryId));
      const allAccumulations = await tx.select().from(quotaAccumulations).where(eq(quotaAccumulations.sourceOrderId, deliveryId));
      
      const accumMap: Record<number, number> = {};
      for (const a of allAccumulations) {
        accumMap[a.productId] = (accumMap[a.productId] || 0) + a.quantityAdded;
      }

      const reqMap: Record<number, number> = {};
      for (const oi of orderItems) {
        reqMap[oi.productId] = (reqMap[oi.productId] || 0) + oi.quantity;
      }

      let allReached = true;
      for (const [pId, reqQty] of Object.entries(reqMap)) {
        const acc = accumMap[parseInt(pId)] || 0;
        if (acc < reqQty) {
          allReached = false;
          break;
        }
      }

      if (allReached && order.status === 'DRAFT') {
        await tx.update(deliveryOrders)
          .set({ status: 'READY_FOR_DISPATCH' })
          .where(eq(deliveryOrders.id, deliveryId));
      }

      return NextResponse.json({ 
        success: true, 
        addedCount: qtyToAdd, 
        currentAccumulated: perOrderTotal || 0, 
        targetQuantity: item.quantity,
        isAutoReady: allReached 
      });
    } catch (e: any) {
      console.error(e);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  });
}
