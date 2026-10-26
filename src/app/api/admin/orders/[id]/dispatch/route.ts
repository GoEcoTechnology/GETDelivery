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
    const isPlatformOwner = claims?.role === 'PLATFORM_OWNER';
    
    if (!claims || (!claims.tenantId && !isPlatformOwner)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const params = await context.params;
    const orderId = parseInt(params.id, 10);

    const [order] = await db.select().from(deliveryOrders).where(
      isPlatformOwner 
        ? eq(deliveryOrders.id, orderId)
        : and(eq(deliveryOrders.id, orderId), eq(deliveryOrders.tenantId, claims.tenantId as number))
    );
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const tenantIdToUse = order.tenantId;

    // Fetch items to dispatch
    const items = await db.select().from(deliveryItems).where(eq(deliveryItems.deliveryOrderId, orderId));

    const uniqueVariantIds = Array.from(new Set(items.map(ti => ti.variantId)));
    const createdBatchIds: number[] = [];

    for (const vId of uniqueVariantIds) {
        if (!vId) continue;
        
        // Find unbatched items for this variant
        const unbatchedResult = await db.execute(sql`
          SELECT di.id, di.delivery_order_id, di.quantity, dord.customer_id, pv.quota, pv.weight_per_piece_kg, pv.weight as variant_weight, p.weight_kg as product_weight, di.weight_kg as existing_item_weight, dord.pickup_address, psu.weight as selling_unit_weight, psu.weight_kg as selling_unit_weight_kg, psu.equivalent_qty
          FROM delivery_items di
          JOIN delivery_orders dord ON di.delivery_order_id = dord.id
          JOIN product_variants pv ON di.variant_id = pv.id
          JOIN products p ON di.product_id = p.id
          LEFT JOIN product_selling_units psu ON psu.product_id = di.product_id AND (psu.variant_id IS NULL OR psu.variant_id = pv.id) AND TRIM(psu.unit_name) ILIKE TRIM(di.unit)
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
        
        let totalQty = 0;
        let totalWeight = 0;
        const itemsToBatch = [];
        const pickupLoc = (unbatchedResult[0] as any).pickup_address || 'Main Store';

        for (const row of unbatchedResult as any[]) {
          const qty = Number(row.quantity) || 0;
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

          const cWeight = Math.round(qty * singleUnitWeight * 100) / 100;
          const deduction = qty * equivMultiplier;
          
          totalQty += deduction;
          totalWeight += cWeight;
          
          await db.update(deliveryItems)
            .set({ weightKg: cWeight.toFixed(2) })
            .where(eq(deliveryItems.id, row.id));

          itemsToBatch.push({
            customerOrderId: row.delivery_order_id,
            customerId: row.customer_id,
            quantity: deduction,
            customerWeight: cWeight.toFixed(2)
          });
        }

        // FORCE DISPATCH bypasses the 'totalQty >= quota' check
        const batchNum = 'DEL-' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        // Find recommended vehicle (check tenant fleet first, then any active vehicle)
        let [suggestedVehicle] = await db
          .select({ id: vehicles.id, vehicleType: vehicles.vehicleType, capacityKg: vehicles.capacityKg })
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

        if (!suggestedVehicle) {
          [suggestedVehicle] = await db
            .select({ id: vehicles.id, vehicleType: vehicles.vehicleType, capacityKg: vehicles.capacityKg })
            .from(vehicles)
            .where(
              and(
                eq(vehicles.status, 'ACTIVE'),
                gte(vehicles.capacityKg, Math.ceil(totalWeight))
              )
            )
            .orderBy(vehicles.capacityKg)
            .limit(1);
        }

        const [batch] = await db.insert(deliveryBatches).values({
            tenantId: (tenantIdToUse || claims.tenantId) as number,
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
        for (const it of itemsToBatch) {
            await db.update(deliveryOrders)
                .set({ 
                  status: 'PROCESSING', 
                  batchId: batch.id,
                  totalWeight: it.customerWeight,
                  suggestedVehicleId: suggestedVehicle?.id || null,
                  vehicleCapacityKg: suggestedVehicle?.capacityKg || null,
                  requiredVehicleType: suggestedVehicle?.vehicleType || null,
                  preferredVehicle: suggestedVehicle?.vehicleType || null,
                })
                .where(eq(deliveryOrders.id, it.customerOrderId));
        }

        createdBatchIds.push(batch.id);
    }

    return NextResponse.json({ success: true, batchIds: createdBatchIds, tenantId: tenantIdToUse });
  } catch (error: any) {
    console.error('Error dispatching order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
