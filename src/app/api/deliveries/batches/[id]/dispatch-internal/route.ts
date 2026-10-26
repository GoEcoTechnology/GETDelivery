import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryBatches, deliveryAssignments, drivers, vehicles, deliveryBatchItems } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { deductOrderStock } from '@/lib/inventory-helper';
import { sendDriverAssignmentNotification } from '@/lib/emailWorkflowHelper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.dispatch'] }, async (tx, claims) => {
    const batchId = parseInt((await params).id, 10);
    
    if (isNaN(batchId)) {
      return NextResponse.json({ error: 'Invalid batch ID' }, { status: 400 });
    }

    const { driverId, vehicleId } = await request.json();

    if (!driverId || !vehicleId) {
      return NextResponse.json({ error: 'Driver and Vehicle must be provided' }, { status: 400 });
    }

    let tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number | null;

    // Validate the batch
    const [batch] = await tx
      .select()
      .from(deliveryBatches)
      .where(
        tenantIdToUse
          ? and(eq(deliveryBatches.id, batchId), eq(deliveryBatches.tenantId, tenantIdToUse))
          : eq(deliveryBatches.id, batchId)
      );

    if (!batch) {
      return NextResponse.json({ error: 'Delivery batch not found' }, { status: 404 });
    }

    const finalTenantId = (tenantIdToUse || batch.tenantId) as number;

    if (batch.status !== 'READY_FOR_DELIVERY' && batch.status !== 'DRAFT') {
      return NextResponse.json({ error: `Cannot dispatch batch in current status: ${batch.status}` }, { status: 400 });
    }

    // Validate Driver
    const [driver] = await tx
      .select()
      .from(drivers)
      .where(and(
        eq(drivers.id, parseInt(driverId)),
        eq(drivers.tenantId, finalTenantId)
      ));

    if (!driver || driver.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Selected driver is not active or not available' }, { status: 400 });
    }

    const [activeDriverAssignment] = await tx
      .select({ id: deliveryAssignments.id })
      .from(deliveryAssignments)
      .leftJoin(deliveryOrders, eq(deliveryAssignments.deliveryOrderId, deliveryOrders.id))
      .where(
        and(
          eq(deliveryAssignments.driverName, driver.name),
          inArray(deliveryAssignments.status, ['ASSIGNED', 'IN_TRANSIT']),
          inArray(deliveryOrders.status, ['DISPATCHED', 'IN_TRANSIT', 'ACCEPTED', 'ASSIGNED'])
        )
      )
      .limit(1);

    if (activeDriverAssignment) {
      return NextResponse.json({ error: `Driver "${driver.name}" is currently in use on an active delivery.` }, { status: 400 });
    }

    // Validate Vehicle
    const [vehicle] = await tx
      .select()
      .from(vehicles)
      .where(and(
        eq(vehicles.id, parseInt(vehicleId)),
        eq(vehicles.tenantId, finalTenantId)
      ));

    if (!vehicle || vehicle.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Selected vehicle is not active or not available' }, { status: 400 });
    }

    const [activeVehicleAssignment] = await tx
      .select({ id: deliveryAssignments.id })
      .from(deliveryAssignments)
      .leftJoin(deliveryOrders, eq(deliveryAssignments.deliveryOrderId, deliveryOrders.id))
      .where(
        and(
          inArray(deliveryAssignments.status, ['ASSIGNED', 'IN_TRANSIT']),
          inArray(deliveryOrders.status, ['DISPATCHED', 'IN_TRANSIT', 'ACCEPTED', 'ASSIGNED']),
          sql`${deliveryAssignments.vehicleDetails} ILIKE ${'%' + vehicle.plateNumber + '%'}`
        )
      )
      .limit(1);

    if (activeVehicleAssignment) {
      return NextResponse.json({ error: `Vehicle "${vehicle.plateNumber} - ${vehicle.vehicleType}" is currently in use on an active delivery.` }, { status: 400 });
    }

    // Get all orders in this batch
    const batchItems = await tx
      .select({ orderId: deliveryBatchItems.customerOrderId })
      .from(deliveryBatchItems)
      .where(eq(deliveryBatchItems.batchId, batchId));

    if (batchItems.length === 0) {
      return NextResponse.json({ error: 'No orders found in this batch (batchItems empty)' }, { status: 400 });
    }
    
    const orderIds = batchItems.map((item: any) => item.orderId);

    const ordersInBatch = await tx
      .select()
      .from(deliveryOrders)
      .where(inArray(deliveryOrders.id, orderIds));

    if (ordersInBatch.length === 0) {
      return NextResponse.json({ error: 'No orders found in this batch' }, { status: 400 });
    }

    const ordersWeightSum = ordersInBatch.reduce((sum: number, o: any) => sum + (Number(o.totalWeight) || 0), 0);
    let batchWeight = Number(batch.totalWeight) || 0;
    if (batchWeight <= 0 || (ordersWeightSum > 0 && Math.abs(batchWeight - ordersWeightSum) > 0.01)) {
      batchWeight = ordersWeightSum;
      await tx.update(deliveryBatches)
        .set({ totalWeight: batchWeight.toFixed(2) })
        .where(eq(deliveryBatches.id, batchId));
    }

    // Verify physical cargo fit and payload capacity
    const { canShipmentFitInVehicle } = await import('@/lib/deliveryCalculation');

    const rawItems = await tx.execute(sql`
      SELECT di.id, di.quantity, di.weight_kg as item_weight_kg,
        di.length_cm as item_length, di.width_cm as item_width, di.height_cm as item_height,
        psu.length_cm as su_length, psu.width_cm as su_width, psu.height_cm as su_height,
        psu.weight as su_weight_str, psu.weight_kg as su_weight_kg, psu.equivalent_qty as su_equiv,
        pv.length_cm as var_length, pv.width_cm as var_width, pv.height_cm as var_height,
        pv.weight_per_piece_kg as var_weight_piece, pv.weight as var_weight_str,
        p.length_cm as prod_length, p.width_cm as prod_width, p.height_cm as prod_height,
        p.weight_kg as prod_weight_kg, p.name as prod_name
      FROM delivery_items di
      JOIN products p ON di.product_id = p.id
      JOIN product_variants pv ON di.variant_id = pv.id
      LEFT JOIN product_selling_units psu ON psu.product_id = di.product_id AND (psu.variant_id IS NULL OR psu.variant_id = pv.id) AND TRIM(psu.unit_name) ILIKE TRIM(di.unit)
      WHERE di.delivery_order_id IN (${sql.raw(orderIds.join(','))})
    `);

    const packingItemsForBatch = (rawItems as any[]).map(r => {
      const qty = Number(r.quantity) || 1;
      const l = Number(r.su_length || r.var_length || r.prod_length || r.item_length) || 50;
      const w = Number(r.su_width || r.var_width || r.prod_width || r.item_width) || 40;
      const h = Number(r.su_height || r.var_height || r.prod_height || r.item_height) || 30;

      const suWeight = Number(r.su_weight_kg) || Number(r.su_weight_str) || 0;
      const varWeight = Number(r.var_weight_piece) || Number(r.var_weight_str) || 0;
      const prodWeight = Number(r.prod_weight_kg) || 0;
      const equiv = Number(r.su_equiv) || 1;

      let unitWeight = 0;
      if (suWeight > 0) unitWeight = suWeight;
      else if (varWeight > 0) unitWeight = varWeight * equiv;
      else if (prodWeight > 0) unitWeight = prodWeight * equiv;
      else if (Number(r.item_weight_kg) > 0) unitWeight = Number(r.item_weight_kg) / qty;

      return {
        lengthCm: l,
        widthCm: w,
        heightCm: h,
        quantity: qty,
        weightKg: Math.round(unitWeight * qty * 100) / 100,
        name: r.prod_name || 'Item'
      };
    });

    const fitResult = canShipmentFitInVehicle(packingItemsForBatch, {
      capacityKg: vehicle.capacityKg,
      cargoLengthCm: Number(vehicle.cargoLengthCm) || 0,
      cargoWidthCm: Number(vehicle.cargoWidthCm) || 0,
      cargoHeightCm: Number(vehicle.cargoHeightCm) || 0,
      vehicleType: vehicle.vehicleType
    });

    if (!fitResult.fits) {
      console.warn(`[Dispatch Warning] Vehicle ${vehicle.vehicleType} (${vehicle.plateNumber}) does not fit batch shipment: ${fitResult.reason}. Proceeding with user override.`);
    }

    try {
      // 0. Deduct Stock for all orders
      for (const order of ordersInBatch) {
        await deductOrderStock(tx, finalTenantId, order.id, claims.userId as number);
      }

      // 1. Update all order statuses
      const { vehicleDeliveryRates } = await import('@/db/schema');
      const [vRate] = await tx.select().from(vehicleDeliveryRates).where(eq(vehicleDeliveryRates.vehicleType, vehicle.vehicleType));
      const { sql } = await import('drizzle-orm');

      const updateData: any = { status: 'IN_TRANSIT', preferredVehicle: vehicle.vehicleType };
      if (vRate) {
        updateData.vehicleBasePrice = vRate.basePrice;
        updateData.pricePerKm = vRate.pricePerKm;
        updateData.finalDeliveryPrice = sql`${vRate.basePrice} + (distance_km * ${vRate.pricePerKm}) + COALESCE(urgent_additional_fee, 0)`;
      }

      await tx
        .update(deliveryOrders)
        .set(updateData)
        .where(inArray(deliveryOrders.id, orderIds));

      // 2. Create Assignments for all orders
      const assignments = ordersInBatch.map((order: any) => ({
        tenantId: finalTenantId,
        deliveryOrderId: order.id,
        driverName: driver.name,
        vehicleDetails: `${vehicle.plateNumber} - ${vehicle.vehicleType}`,
        status: 'ASSIGNED'
      }));
      if (assignments.length > 0) {
        await tx.insert(deliveryAssignments).values(assignments);
      }

      // 3. Mark batch as DISPATCHED
      await tx
        .update(deliveryBatches)
        .set({ status: 'DISPATCHED' })
        .where(eq(deliveryBatches.id, batchId));

      // 4. Mark driver and vehicle as NOT AVAILABLE
      await tx.update(drivers).set({ status: 'NOT AVAILABLE' }).where(eq(drivers.id, parseInt(driverId)));
      await tx.update(vehicles).set({ status: 'NOT AVAILABLE' }).where(eq(vehicles.id, parseInt(vehicleId)));

      // Send email to assigned driver for the first order in batch (or a combined email, but currently we just use the first order for simplicity)
      if (ordersInBatch.length > 0) {
        const order = ordersInBatch[0];
        const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/driver/dashboard/${order.id}`;
        sendDriverAssignmentNotification(
          finalTenantId,
          driver.id,
          driver.name,
          `${vehicle.plateNumber} - ${vehicle.vehicleType}`,
          batchId,
          ordersInBatch.length,
          batch.pickupLocation,
          order.deliveryTime,
          dashboardUrl,
          order.id
        ).catch(err => {
          console.error('Failed to send driver assignment email:', err.message);
        });
      }

      return NextResponse.json({ success: true, message: 'Batch dispatched internally successfully' });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to dispatch batch due to inventory constraints' }, { status: 400 });
    }
  });
}
