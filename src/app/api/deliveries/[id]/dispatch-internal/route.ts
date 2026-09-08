import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryAssignments, drivers, vehicles, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { deductOrderStock } from '@/lib/inventory-helper';
import { sendDriverAssignmentNotification } from '@/lib/emailWorkflowHelper';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.dispatch'] }, async (tx, claims) => {
    const orderId = parseInt((await params).id, 10);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid delivery ID' }, { status: 400 });
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

    // Validate the order
    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, orderId),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!order) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
    }

    if (order.status !== 'READY_FOR_DISPATCH') {
      return NextResponse.json({ error: `Only READY_FOR_DISPATCH orders can be dispatched. Current status: ${order.status}` }, { status: 400 });
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

    try {
      // 0. Deduct Stock (throws if insufficient)
      await deductOrderStock(tx, tenantIdToUse, order.id, claims.userId as number);

      // 1. Update order status
      const updateData: any = { status: 'IN_TRANSIT' };
      if (customFee !== undefined && customFee !== null) {
        updateData.finalDeliveryPrice = customFee.toString();
      }

      await tx
        .update(deliveryOrders)
        .set(updateData)
        .where(eq(deliveryOrders.id, order.id));

      // 2. Create Assignment (no deliveryPartnerId for internal)
      await tx.insert(deliveryAssignments).values({
        tenantId: tenantIdToUse,
        deliveryOrderId: order.id,
        driverName: driver.name,
        vehicleDetails: `${vehicle.plateNumber} - ${vehicle.vehicleType}`,
        status: 'ASSIGNED'
      });

      // 3. Mark driver and vehicle as NOT AVAILABLE
      await tx.update(drivers).set({ status: 'NOT AVAILABLE' }).where(eq(drivers.id, parseInt(driverId)));
      await tx.update(vehicles).set({ status: 'NOT AVAILABLE' }).where(eq(vehicles.id, parseInt(vehicleId)));

      // Send email to assigned driver (fire-and-forget)
      const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/driver/dashboard/${order.id}`;
      sendDriverAssignmentNotification(
        tenantIdToUse,
        driver.id,
        driver.name,
        `${vehicle.plateNumber} - ${vehicle.vehicleType}`,
        order.batchId || 0,
        1,
        order.pickupAddress,
        order.deliveryTime,
        dashboardUrl,
        order.id
      ).catch(err => {
        console.error('Failed to send driver assignment email:', err.message);
      });

      return NextResponse.json({ success: true, message: 'Dispatched internally successfully' });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to dispatch order due to inventory constraints' }, { status: 400 });
    }
  });
}
