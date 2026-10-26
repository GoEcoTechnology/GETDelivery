import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems, productVariants, deliveryBatches, deliveryBatchItems, vehicles, inventoryTransactions, vehicleDeliveryRates } from '@/db/schema';
import { eq, and, sql, gte, inArray } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';
import { canShipmentFitInVehicle } from '@/lib/deliveryCalculation';

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
    const primaryVariantId = body.basisVariantId || uniqueVariantIds[0];

    // Find all items in all requested orders
    const orderIdsCsv = orderIds.join(',');

    const unbatchedResult = await db.execute(sql`
      SELECT di.id, di.delivery_order_id, di.quantity, di.product_id, di.variant_id, di.unit, dord.customer_id, pv.quota, pv.weight_per_piece_kg, pv.weight as variant_weight, p.weight_kg as product_weight, di.weight_kg as existing_item_weight, dord.pickup_address, psu.weight as selling_unit_weight, psu.weight_kg as selling_unit_weight_kg, psu.equivalent_qty, pv.stock as current_stock, dord.batch_id as old_batch_id,
        di.length_cm as item_length, di.width_cm as item_width, di.height_cm as item_height,
        psu.length_cm as su_length, psu.width_cm as su_width, psu.height_cm as su_height,
        pv.length_cm as var_length, pv.width_cm as var_width, pv.height_cm as var_height,
        p.length_cm as prod_length, p.width_cm as prod_width, p.height_cm as prod_height,
        p.name as product_name
      FROM delivery_items di
      JOIN delivery_orders dord ON di.delivery_order_id = dord.id
      JOIN product_variants pv ON di.variant_id = pv.id
      JOIN products p ON di.product_id = p.id
      LEFT JOIN product_selling_units psu ON psu.product_id = di.product_id AND (psu.variant_id IS NULL OR psu.variant_id = pv.id) AND TRIM(psu.unit_name) ILIKE TRIM(di.unit)
      WHERE dord.status != 'CANCELLED'
        AND dord.id IN (${sql.raw(orderIdsCsv)})
      ORDER BY dord.created_at ASC
    `);

    console.log('[BATCH-DISPATCH] orderIds:', orderIds);
    console.log('[BATCH-DISPATCH] orderIdsCsv:', orderIdsCsv);
    console.log('[BATCH-DISPATCH] unbatchedResult:', unbatchedResult);

    if (unbatchedResult.length === 0) {
      return NextResponse.json({ error: 'No unbatched items found' }, { status: 400 });
    }

    const pickupLoc = (unbatchedResult[0] as any).pickup_address || 'Main Store';

    let totalWeight = 0;
    
    // To aggregate items to batch properly by order:
    // A single order goes into the batch ONCE, but its weight is the SUM of all its items.
    const orderWeightMap = new Map<number, number>();
    const orderCustomerMap = new Map<number, number>();
    const orderQtyMap = new Map<number, number>();

    const variantInventoryDeductions = new Map<number, { productId: number; deduction: number; currentStock: number }>();

    const oldBatchIds = new Set<number>();

    for (const row of unbatchedResult as any[]) {
      const qty = Number(row.quantity) || 0;
      const vId = Number(row.variant_id);
      const pId = Number(row.product_id);
      const oldBatchId = row.old_batch_id;
      
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
      totalWeight += itemWeight;
      
      // Update item weight in deliveryItems
      await db.update(deliveryItems)
        .set({ weightKg: itemWeight.toFixed(2) })
        .where(eq(deliveryItems.id, row.id));
      
      if (oldBatchId) {
        oldBatchIds.add(oldBatchId);
      } else {
        // Calculate inventory deduction based on selling unit conversion only for newly batched items
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

    // FORCE DISPATCH bypasses the 'totalQty >= quota' check
    let baseBatchNum = body.batchName || ('DEL-' + Math.random().toString(36).substr(2, 6).toUpperCase());
    if (baseBatchNum.length > 45) {
      baseBatchNum = baseBatchNum.substring(0, 45);
    }
    let batchNum = baseBatchNum;
    
    // Ensure uniqueness of batchNum
    const existingBatches = await db.select({ batchNumber: deliveryBatches.batchNumber })
                                    .from(deliveryBatches)
                                    .where(sql`${deliveryBatches.batchNumber} LIKE ${baseBatchNum + '%'}`);
    
    if (existingBatches.some(b => b.batchNumber === batchNum)) {
       let counter = 1;
       while(existingBatches.some(b => b.batchNumber === `${baseBatchNum} (${counter})`)) {
           counter++;
       }
       batchNum = `${baseBatchNum} (${counter})`;
    }
    
    // Build packing items with resolved 3D dimensions
    const packingItemsForBatch = (unbatchedResult as any[]).map(r => {
      let l = Number(r.su_length || r.var_length || r.prod_length || r.item_length) || 50;
      let w = Number(r.su_width || r.var_width || r.prod_width || r.item_width) || 40;
      let h = Number(r.su_height || r.var_height || r.prod_height || r.item_height) || 30;
      const qty = Number(r.quantity) || 1;
      const itemWeight = Number(r.existing_item_weight) || 0;
      return {
        lengthCm: l,
        widthCm: w,
        heightCm: h,
        quantity: qty,
        weightKg: itemWeight,
        name: r.product_name || 'Item'
      };
    });

    // Fetch active vehicle delivery rates
    const rates = await db.select().from(vehicleDeliveryRates).where(eq(vehicleDeliveryRates.isActive, true));

    // Find recommended vehicle evaluating BOTH payload capacity AND physical cargo dimensions
    const allActiveVehicles = await db
      .select({
        id: vehicles.id,
        vehicleType: vehicles.vehicleType,
        capacityKg: vehicles.capacityKg,
        cargoLengthCm: vehicles.cargoLengthCm,
        cargoWidthCm: vehicles.cargoWidthCm,
        cargoHeightCm: vehicles.cargoHeightCm,
        tenantId: vehicles.tenantId,
      })
      .from(vehicles)
      .where(eq(vehicles.status, 'ACTIVE'));

    const evaluatedVehicles = allActiveVehicles.map((v: any) => {
      const matchedRate = rates.find((r: any) => r.vehicleType.trim().toLowerCase() === v.vehicleType.trim().toLowerCase());
      return {
        ...v,
        capacityKg: v.capacityKg || matchedRate?.capacityKg || 1000,
        cargoLengthCm: Number(v.cargoLengthCm) || Number(matchedRate?.cargoLengthCm) || 0,
        cargoWidthCm: Number(v.cargoWidthCm) || Number(matchedRate?.cargoWidthCm) || 0,
        cargoHeightCm: Number(v.cargoHeightCm) || Number(matchedRate?.cargoHeightCm) || 0,
      };
    });

    const eligibleVehicles = evaluatedVehicles.filter((v: any) => {
      const fit = canShipmentFitInVehicle(packingItemsForBatch, {
        capacityKg: v.capacityKg,
        cargoLengthCm: v.cargoLengthCm,
        cargoWidthCm: v.cargoWidthCm,
        cargoHeightCm: v.cargoHeightCm,
        vehicleType: v.vehicleType,
      });
      return fit.fits;
    });

    eligibleVehicles.sort((a: any, b: any) => a.capacityKg - b.capacityKg);

    const tenantVehicles = eligibleVehicles.filter((v: any) => v.tenantId === (claims.tenantId as number));
    let suggestedVehicle = tenantVehicles[0] || eligibleVehicles[0];

    // Sum total quantity of items matching the primary variant quota
    let totalQty = 0;
    for (const row of unbatchedResult as any[]) {
      if (!primaryVariantId || Number(row.variant_id) === Number(primaryVariantId)) {
        const qty = Number(row.quantity) || 0;
        const equiv = Number(row.equivalent_qty) || 1;
        totalQty += (qty * equiv);
      }
    }

    const primaryRow = (unbatchedResult as any[]).find(r => Number(r.variant_id) === primaryVariantId) || unbatchedResult[0];
    const quota = Number(primaryRow.quota || 50);

    const [batch] = await db.insert(deliveryBatches).values({
        tenantId: claims.tenantId as number,
        batchNumber: batchNum,
        variantId: primaryVariantId,
        totalQuantity: totalQty,
        quotaQuantity: quota,
        totalWeight: totalWeight.toString(),
        pickupLocation: pickupLoc,
        suggestedVehicleId: suggestedVehicle?.id || null,
        status: 'DRAFT'
    }).returning();

    // Update all associated orders to 'PROCESSING' and set batchId first to avoid foreign key errors
    for (const [oId, w] of orderWeightMap.entries()) {
        await db.update(deliveryOrders)
            .set({ 
              status: 'PROCESSING', 
              batchId: batch.id,
              totalWeight: w.toFixed(2),
              suggestedVehicleId: suggestedVehicle?.id || null,
              vehicleCapacityKg: suggestedVehicle?.capacityKg || null,
              requiredVehicleType: suggestedVehicle?.vehicleType || null,
              preferredVehicle: suggestedVehicle?.vehicleType || null,
            })
            .where(eq(deliveryOrders.id, oId));
    }

    // Remove old batch items if moving from existing batches
    if (oldBatchIds.size > 0) {
        await db.execute(sql`
            DELETE FROM delivery_batch_items 
            WHERE customer_order_id IN (${sql.raw(orderIdsCsv)})
        `);
        // Recalculate or clean up old batches (if they are now empty)
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

    const dbBatchItems = Array.from(orderWeightMap.entries()).map(([oId, w]) => ({
        batchId: batch.id,
        customerOrderId: oId,
        customerId: orderCustomerMap.get(oId)!,
        quantity: orderQtyMap.get(oId)!,
        customerWeight: w.toFixed(2)
    }));

    await db.insert(deliveryBatchItems).values(dbBatchItems);


    // Deduct Inventory for all variants
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

    return NextResponse.json({ success: true, batchIds: [batch.id], tenantId: batch.tenantId });
  } catch (error: any) {
    require('fs').appendFileSync('error.log', error.stack + '\n');
    console.error('Error dispatching batch order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
