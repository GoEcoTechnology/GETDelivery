import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, productVariants, deliveryBatches, deliveryBatchItems, vehicles, inventoryTransactions } from '@/db/schema';
import { eq, and, sql, gte, inArray } from 'drizzle-orm';
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
    const { orderIds } = body;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: 'No order IDs provided' }, { status: 400 });
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

    // Fetch items for the selected orders
    const items = await db.select().from(deliveryItems)
      .where(inArray(deliveryItems.deliveryOrderId, orderIds));

    const uniqueVariantIds = Array.from(new Set(items.map(ti => ti.variantId)));
    const createdBatchIds: number[] = [];

    for (const vId of uniqueVariantIds) {
        if (!vId) continue;
        
        // Find unbatched items for this variant, but ONLY for the specifically requested orderIds
        const orderIdsCsv = orderIds.join(',');
        
        const unbatchedResult = await db.execute(sql`
          SELECT di.id, di.delivery_order_id, di.quantity, di.product_id, di.unit, dord.customer_id, pv.quota, pv.weight_per_piece_kg, dord.pickup_address, psu.weight as selling_unit_weight, psu.equivalent_qty, pv.stock as current_stock
          FROM delivery_items di
          JOIN delivery_orders dord ON di.delivery_order_id = dord.id
          JOIN product_variants pv ON di.variant_id = pv.id
          LEFT JOIN product_selling_units psu ON psu.variant_id = pv.id AND psu.unit_name = di.unit
          WHERE di.variant_id = ${vId}
            AND dord.status != 'CANCELLED'
            AND dord.id IN (${sql.raw(orderIdsCsv)})
            AND NOT EXISTS (
              SELECT 1 FROM delivery_batch_items dbi
              JOIN delivery_batches dbatch ON dbi.batch_id = dbatch.id
              WHERE dbi.customer_order_id = di.delivery_order_id
                AND dbatch.variant_id = ${vId}
            )
          ORDER BY dord.created_at ASC
        `);

        if (unbatchedResult.length === 0) continue;

        const quota = Number((unbatchedResult[0] as any).quota || 50);
        const productId = Number((unbatchedResult[0] as any).product_id);
        const currentStock = Number((unbatchedResult[0] as any).current_stock || 0);
        
        let totalQty = 0;
        let totalWeight = 0;
        let totalInventoryDeduction = 0;
        const itemsToBatch = [];
        const pickupLoc = (unbatchedResult[0] as any).pickup_address || 'TBD';

        for (const row of unbatchedResult as any[]) {
          const qty = Number(row.quantity);
          totalQty += qty;
          
          const explicitUnitWeight = Number(row.selling_unit_weight) || 0;
          const cWeight = qty * explicitUnitWeight;
          totalWeight += cWeight;
          
          // Calculate inventory deduction based on selling unit conversion
          const equivalentQty = Number(row.equivalent_qty) || 1;
          const deduction = qty * equivalentQty;
          totalInventoryDeduction += deduction;

          itemsToBatch.push({
            customerOrderId: row.delivery_order_id,
            customerId: row.customer_id,
            quantity: qty,
            customerWeight: cWeight.toFixed(2)
          });
        }

        // FORCE DISPATCH bypasses the 'totalQty >= quota' check
        const batchNum = 'DEL-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        // Find recommended vehicle
        const [suggestedVehicle] = await db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(
            and(
            eq(vehicles.tenantId, claims.tenantId as number),
            eq(vehicles.status, 'ACTIVE'),
            gte(vehicles.capacityKg, Math.ceil(totalWeight))
            )
        )
        .orderBy(vehicles.capacityKg)
        .limit(1);

        const [batch] = await db.insert(deliveryBatches).values({
            tenantId: claims.tenantId as number,
            batchNumber: batchNum,
            variantId: vId,
            totalQuantity: totalQty,
            quotaQuantity: quota,
            totalWeight: totalWeight.toString(),
            pickupLocation: pickupLoc,
            suggestedVehicleId: suggestedVehicle?.id || null,
            status: 'READY_FOR_DELIVERY'
        }).returning();

        const dbBatchItems = itemsToBatch.map(it => ({
            batchId: batch.id,
            customerOrderId: it.customerOrderId,
            customerId: it.customerId,
            quantity: it.quantity,
            customerWeight: it.customerWeight.toString()
        }));

        await db.insert(deliveryBatchItems).values(dbBatchItems);

        // Update all associated orders to 'PROCESSING' and set batchId
        const orderIdsToUpdate = itemsToBatch.map(it => it.customerOrderId);
        for (const oId of orderIdsToUpdate) {
            await db.update(deliveryOrders)
                .set({ status: 'PROCESSING', batchId: batch.id })
                .where(eq(deliveryOrders.id, oId));
        }

        // Deduct Inventory
        if (totalInventoryDeduction > 0) {
          const newStock = currentStock - totalInventoryDeduction;
          
          await db.update(productVariants)
            .set({ stock: newStock })
            .where(eq(productVariants.id, vId));

          await db.insert(inventoryTransactions).values({
            tenantId: claims.tenantId as number,
            productId: productId,
            variantId: vId,
            quantity: totalInventoryDeduction,
            previousStock: currentStock,
            newStock: newStock,
            transactionType: 'OUT',
            reference: 'Delivery Order'
          });
        }

        createdBatchIds.push(batch.id);
    }

    return NextResponse.json({ success: true, batchIds: createdBatchIds });
  } catch (error: any) {
    console.error('Error dispatching batch order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
