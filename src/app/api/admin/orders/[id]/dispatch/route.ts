import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, productVariants, deliveryBatches, deliveryBatchItems, vehicles } from '@/db/schema';
import { eq, and, sql, gte } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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
    
    const params = await context.params;
    const orderId = parseInt(params.id, 10);

    const [order] = await db.select().from(deliveryOrders).where(and(eq(deliveryOrders.id, orderId), eq(deliveryOrders.tenantId, claims.tenantId as number)));
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // Fetch items to dispatch
    const items = await db.select().from(deliveryItems).where(eq(deliveryItems.deliveryOrderId, orderId));

    const uniqueVariantIds = Array.from(new Set(items.map(ti => ti.variantId)));
    const createdBatchIds: number[] = [];

    for (const vId of uniqueVariantIds) {
        if (!vId) continue;
        
        // Find unbatched items for this variant
        const unbatchedResult = await db.execute(sql`
          SELECT di.id, di.delivery_order_id, di.quantity, dord.customer_id, pv.quota, pv.weight_per_piece_kg, dord.pickup_address, psu.weight as selling_unit_weight
          FROM delivery_items di
          JOIN delivery_orders dord ON di.delivery_order_id = dord.id
          JOIN product_variants pv ON di.variant_id = pv.id
          LEFT JOIN product_selling_units psu ON psu.variant_id = pv.id AND psu.unit_name = di.unit
          WHERE di.variant_id = ${vId}
            AND dord.status != 'CANCELLED'
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
        const weightPerPieceKg = Number((unbatchedResult[0] as any).weight_per_piece_kg || 0);
        
        let totalQty = 0;
        let totalWeight = 0;
        const itemsToBatch = [];
        const pickupLoc = (unbatchedResult[0] as any).pickup_address || 'TBD';

        for (const row of unbatchedResult as any[]) {
          const qty = Number(row.quantity);
          totalQty += qty;
          const explicitUnitWeight = Number(row.selling_unit_weight) || 0;
          const cWeight = qty * explicitUnitWeight;
          totalWeight += cWeight;
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

        createdBatchIds.push(batch.id);
    }

    return NextResponse.json({ success: true, batchIds: createdBatchIds });
  } catch (error: any) {
    console.error('Error dispatching order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
