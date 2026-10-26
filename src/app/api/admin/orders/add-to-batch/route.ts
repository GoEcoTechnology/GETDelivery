import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, productVariants, deliveryBatches, deliveryBatchItems, inventoryTransactions } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';
import { determineVehicleForBatch } from '@/lib/deliveryCalculation';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);
    const isPlatformOwner = claims?.role === 'PLATFORM_OWNER';
    
    if (!claims || (!claims.tenantId && !isPlatformOwner)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { orderIds, targetBatchId } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0 || !targetBatchId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify target batch exists
    const [targetBatch] = await db.select().from(deliveryBatches)
      .where(
        isPlatformOwner
          ? eq(deliveryBatches.id, targetBatchId)
          : and(eq(deliveryBatches.id, targetBatchId), eq(deliveryBatches.tenantId, claims.tenantId as number))
      );

    if (!targetBatch) {
      return NextResponse.json({ error: 'Target batch not found' }, { status: 404 });
    }

    const effectiveTenantId = targetBatch.tenantId;

    if (targetBatch.status === 'DISPATCHED' || targetBatch.status === 'DELIVERED') {
       return NextResponse.json({ error: 'Cannot add to a dispatched or delivered batch' }, { status: 400 });
    }

    // Verify all orders exist and belong to the tenant
    const orders = await db.select().from(deliveryOrders)
      .where(
        and(
          inArray(deliveryOrders.id, orderIds),
          eq(deliveryOrders.tenantId, effectiveTenantId)
        )
      );

    if (orders.length !== orderIds.length) {
      return NextResponse.json({ error: 'One or more orders not found or unauthorized' }, { status: 404 });
    }

    const orderIdsCsv = orderIds.join(',');

    const unbatchedResult = await db.execute(sql`
      SELECT di.id, di.delivery_order_id, di.quantity, di.product_id, di.variant_id, di.unit, dord.customer_id, pv.quota, pv.weight_per_piece_kg, pv.weight as variant_weight, p.weight_kg as product_weight, di.weight_kg as existing_item_weight, psu.weight as selling_unit_weight, psu.weight_kg as selling_unit_weight_kg, psu.equivalent_qty, pv.stock as current_stock, dord.batch_id as old_batch_id
      FROM delivery_items di
      JOIN delivery_orders dord ON di.delivery_order_id = dord.id
      JOIN product_variants pv ON di.variant_id = pv.id
      JOIN products p ON di.product_id = p.id
      LEFT JOIN product_selling_units psu ON psu.product_id = di.product_id AND (psu.variant_id IS NULL OR psu.variant_id = pv.id) AND TRIM(psu.unit_name) ILIKE TRIM(di.unit)
      WHERE dord.status != 'CANCELLED'
        AND dord.id IN (${sql.raw(orderIdsCsv)})
    `);

    if (unbatchedResult.length === 0) {
      return NextResponse.json({ error: 'No valid items found for these orders' }, { status: 400 });
    }

    let addedWeight = 0;
    
    const orderWeightMap = new Map<number, number>();
    const orderCustomerMap = new Map<number, number>();
    const orderQtyMap = new Map<number, number>();
    const oldBatchIds = new Set<number>();
    const variantInventoryDeductions = new Map<number, { productId: number; deduction: number; currentStock: number }>();

    for (const row of unbatchedResult as any[]) {
      const qty = Number(row.quantity) || 0;
      const vId = Number(row.variant_id);
      const pId = Number(row.product_id);
      const oldBatchId = row.old_batch_id;
      
      if (oldBatchId && oldBatchId === targetBatchId) {
        continue; // Already in target batch
      }

      const sellingUnitWeight = Number(row.selling_unit_weight_kg) || Number(row.selling_unit_weight) || 0;
      const pieceWeight = Number(row.weight_per_piece_kg) || Number(row.variant_weight) || 0;
      const productWeight = Number(row.product_weight) || 0;
      const equivMultiplier = Number(row.equivalent_qty) || 1;

      let singleUnitWeight = 0;
      if (sellingUnitWeight > 0) {
        singleUnitWeight = sellingUnitWeight;
      } else if (pieceWeight > 0) {
        singleUnitWeight = pieceWeight * equivMultiplier;
      } else if (productWeight > 0) {
        singleUnitWeight = productWeight * equivMultiplier;
      } else if (Number(row.existing_item_weight) > 0) {
        singleUnitWeight = Number(row.existing_item_weight) / (qty || 1);
      }

      const itemWeight = Math.round(qty * singleUnitWeight * 100) / 100;
      addedWeight += itemWeight;

      await db.update(deliveryItems)
        .set({ weightKg: itemWeight.toFixed(2) })
        .where(eq(deliveryItems.id, row.id));

      if (oldBatchId) {
         oldBatchIds.add(oldBatchId);
      } else {
         const deduction = qty * equivMultiplier;
         const currentStock = Number(row.current_stock || 0);

         const existing = variantInventoryDeductions.get(vId) || { productId: pId, deduction: 0, currentStock };
         existing.deduction += deduction;
         variantInventoryDeductions.set(vId, existing);
      }
      
      const oId = row.delivery_order_id;
      const deduction = qty * equivMultiplier;
      
      orderWeightMap.set(oId, (orderWeightMap.get(oId) || 0) + itemWeight);
      orderQtyMap.set(oId, (orderQtyMap.get(oId) || 0) + deduction);
      orderCustomerMap.set(oId, row.customer_id);
    }

    if (orderWeightMap.size === 0) {
        return NextResponse.json({ success: true, message: 'All selected orders were already in the target batch.' });
    }

    // Update deliveryOrders to point to new batch first to avoid FK errors
    for (const oId of orderWeightMap.keys()) {
      await db.update(deliveryOrders)
          .set({ status: 'PROCESSING', batchId: targetBatchId })
          .where(eq(deliveryOrders.id, oId));
    }

    // Delete old batch items if moving from existing batches
    if (oldBatchIds.size > 0) {
       await db.execute(sql`
         DELETE FROM delivery_batch_items
         WHERE customer_order_id IN (${sql.raw(orderIdsCsv)})
       `);

       // Recalculate or delete old batches
       for (const oldBId of oldBatchIds) {
           const remainingItems = await db.select().from(deliveryBatchItems).where(eq(deliveryBatchItems.batchId, oldBId));
           if (remainingItems.length === 0) {
               await db.delete(deliveryBatches).where(eq(deliveryBatches.id, oldBId));
           } else {
               let newTotalQty = 0;
               let newTotalWeight = 0;
               for (const rem of remainingItems) {
                   newTotalQty += rem.quantity;
                   newTotalWeight += Number(rem.customerWeight);
               }
               await db.update(deliveryBatches)
                 .set({ totalQuantity: newTotalQty, totalWeight: newTotalWeight.toString() })
                 .where(eq(deliveryBatches.id, oldBId));
           }
       }
    }

    let addedQty = 0;
    for (const q of orderQtyMap.values()) addedQty += q;

    const dbBatchItems = Array.from(orderWeightMap.entries()).map(([oId, w]) => ({
        batchId: targetBatchId,
        customerOrderId: oId,
        customerId: orderCustomerMap.get(oId)!,
        quantity: orderQtyMap.get(oId)!,
        customerWeight: w.toFixed(2)
    }));

    await db.insert(deliveryBatchItems).values(dbBatchItems);


    // Only add to target batch's quota quantity if items match targetBatch.variantId
    let addedVariantQty = 0;
    for (const row of unbatchedResult as any[]) {
      if (!targetBatch.variantId || Number(row.variant_id) === Number(targetBatch.variantId)) {
        const qty = Number(row.quantity) || 0;
        const equivMultiplier = Number(row.equivalent_qty) || 1;
        addedVariantQty += qty * equivMultiplier;
      }
    }

    const newTotalQty = targetBatch.totalQuantity + addedVariantQty;
    const newTotalWeight = Number(targetBatch.totalWeight || 0) + addedWeight;
    await db.update(deliveryBatches)
       .set({ totalQuantity: newTotalQty, totalWeight: newTotalWeight.toString() })
       .where(eq(deliveryBatches.id, targetBatchId));

    // Recalculate vehicle for target batch based on all products in the batch
    await determineVehicleForBatch(targetBatchId, effectiveTenantId);

    // Deduct Inventory for unbatched items
    for (const [vId, data] of variantInventoryDeductions.entries()) {
      if (data.deduction > 0) {
        const newStock = data.currentStock - data.deduction;
        
        await db.update(productVariants)
          .set({ stock: newStock })
          .where(eq(productVariants.id, vId));

        await db.insert(inventoryTransactions).values({
          tenantId: effectiveTenantId,
          productId: data.productId,
          variantId: vId,
          quantity: data.deduction,
          previousStock: data.currentStock,
          newStock: newStock,
          transactionType: 'OUT',
          reference: 'Delivery Order Batch'
        });
      }
    }

    return NextResponse.json({ success: true, batchId: targetBatchId });
  } catch (error: any) {
    require('fs').appendFileSync('error.log', error.stack + '\n');
    console.error('Error adding to batch:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
