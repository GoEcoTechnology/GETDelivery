import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryBatches, deliveryAssignments, drivers, vehicles, deliveryBatchItems } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
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

    const { driverId, vehicleId, customFee } = await request.json();

    if (!driverId || !vehicleId) {
      return NextResponse.json({ error: 'Driver and Vehicle must be provided' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    if (isNaN(tenantIdToUse)) {
      return NextResponse.json({ error: 'Tenant context is missing or invalid' }, { status: 400 });
    }

    // Validate the batch
    const [batch] = await tx
      .select()
      .from(deliveryBatches)
      .where(and(
        eq(deliveryBatches.id, batchId),
        eq(deliveryBatches.tenantId, tenantIdToUse)
      ));

    if (!batch) {
      return NextResponse.json({ error: 'Delivery batch not found' }, { status: 404 });
    }

    if (batch.status !== 'READY_FOR_DELIVERY') {
      return NextResponse.json({ error: `Only READY_FOR_DELIVERY batches can be dispatched. Current status: ${batch.status}` }, { status: 400 });
    }

    // Validate Driver
    const [driver] = await tx
      .select()
      .from(drivers)
      .where(and(
        eq(drivers.id, parseInt(driverId)),
        eq(drivers.tenantId, tenantIdToUse)
      ));

    if (!driver || driver.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Valid active driver is required' }, { status: 400 });
    }

    // Validate Vehicle
    const [vehicle] = await tx
      .select()
      .from(vehicles)
      .where(and(
        eq(vehicles.id, parseInt(vehicleId)),
        eq(vehicles.tenantId, tenantIdToUse)
      ));

    if (!vehicle || vehicle.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Valid active vehicle is required' }, { status: 400 });
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

    try {
      // 0. Deduct Stock for all orders
      for (const order of ordersInBatch) {
        await deductOrderStock(tx, tenantIdToUse, order.id, claims.userId as number);
      }

      // 1. Update all order statuses
      const updateData: any = { status: 'IN_TRANSIT' };
      if (customFee !== undefined && customFee !== null) {
        updateData.finalDeliveryPrice = customFee.toString();
      }

      await tx
        .update(deliveryOrders)
        .set(updateData)
        .where(inArray(deliveryOrders.id, orderIds));

      // 2. Create Assignments for all orders
      const assignments = ordersInBatch.map((order: any) => ({
        tenantId: tenantIdToUse,
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
          tenantIdToUse,
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
