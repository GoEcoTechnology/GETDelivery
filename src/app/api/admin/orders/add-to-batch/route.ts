import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, productVariants, deliveryBatches, deliveryBatchItems, inventoryTransactions } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
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

    const body = await request.json();
    const { orderIds, targetBatchId } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0 || !targetBatchId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Verify target batch exists
    const [targetBatch] = await db.select().from(deliveryBatches)
      .where(and(eq(deliveryBatches.id, targetBatchId), eq(deliveryBatches.tenantId, claims.tenantId as number)));

    if (!targetBatch) {
      return NextResponse.json({ error: 'Target batch not found' }, { status: 404 });
    }

    if (targetBatch.status === 'DISPATCHED' || targetBatch.status === 'DELIVERED') {
       return NextResponse.json({ error: 'Cannot add to a dispatched or delivered batch' }, { status: 400 });
    }

    // Verify all orders exist and belong to the tenant
    const orders = await db.select().from(deliveryOrders)
      .where(
        and(
          inArray(deliveryOrders.id, orderIds),
          eq(deliveryOrders.tenantId, claims.tenantId as number)
        )
      );

    if (orders.length !== orderIds.length) {
      return NextResponse.json({ error: 'One or more orders not found or unauthorized' }, { status: 404 });
    }

    const orderIdsCsv = orderIds.join(',');

    const unbatchedResult = await db.execute(sql`
      SELECT di.id, di.delivery_order_id, di.quantity, di.product_id, di.variant_id, di.unit, dord.customer_id, pv.quota, pv.weight_per_piece_kg, psu.weight as selling_unit_weight, psu.equivalent_qty, pv.stock as current_stock, dord.batch_id as old_batch_id
      FROM delivery_items di
      JOIN delivery_orders dord ON di.delivery_order_id = dord.id
      JOIN product_variants pv ON di.variant_id = pv.id
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
      const qty = Number(row.quantity);
      const vId = Number(row.variant_id);
      const pId = Number(row.product_id);
      const oldBatchId = row.old_batch_id;
      
      if (oldBatchId && oldBatchId === targetBatchId) {
        continue; // Already in target batch
      }

      if (oldBatchId) {
         oldBatchIds.add(oldBatchId);
         // Note: we should theoretically restore inventory if moving batches? 
         // Actually, if it's already in a batch, its inventory was already deducted!
         // Wait, if it moves from batch to batch, inventory doesn't change.
         // If it moves from unbatched to batch, inventory deducts.
         // For simplicity, if it has NO oldBatchId, we deduct.
      } else {
         const equivalentQty = Number(row.equivalent_qty) || 1;
         const deduction = qty * equivalentQty;
         const currentStock = Number(row.current_stock || 0);

         const existing = variantInventoryDeductions.get(vId) || { productId: pId, deduction: 0, currentStock };
         existing.deduction += deduction;
         variantInventoryDeductions.set(vId, existing);
      }

      const explicitUnitWeight = Number(row.selling_unit_weight) || 0;
      const itemWeight = qty * explicitUnitWeight;
      addedWeight += itemWeight;
      
      const oId = row.delivery_order_id;
      const equivalentQty = Number(row.equivalent_qty) || 1;
      const deduction = qty * equivalentQty;
      
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


    // Update target batch totals
    const newTotalQty = targetBatch.totalQuantity + addedQty;
    const newTotalWeight = Number(targetBatch.totalWeight || 0) + addedWeight;
    await db.update(deliveryBatches)
       .set({ totalQuantity: newTotalQty, totalWeight: newTotalWeight.toString() })
       .where(eq(deliveryBatches.id, targetBatchId));

    // Deduct Inventory for unbatched items
    for (const [vId, data] of variantInventoryDeductions.entries()) {
      if (data.deduction > 0) {
        const newStock = data.currentStock - data.deduction;
        
        await db.update(productVariants)
          .set({ stock: newStock })
          .where(eq(productVariants.id, vId));

        await db.insert(inventoryTransactions).values({
          tenantId: claims.tenantId as number,
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
