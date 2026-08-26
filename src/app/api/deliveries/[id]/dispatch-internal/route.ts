import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryAssignments, drivers, vehicles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.dispatch'] }, async (tx, claims) => {
    const orderId = parseInt((await params).id, 10);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid delivery ID' }, { status: 400 });
    }

    const { driverId, vehicleId } = await request.json();

    if (!driverId || !vehicleId) {
      return NextResponse.json({ error: 'Driver and Vehicle must be provided' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

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

    if (order.status !== 'READY_FOR_DISPATCH' && order.status !== 'DRAFT') {
      return NextResponse.json({ error: `Cannot dispatch delivery in status: ${order.status}` }, { status: 400 });
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

    await tx.transaction(async (innerTx: any) => {
      // 1. Update order status
      await innerTx
        .update(deliveryOrders)
        .set({ status: 'DISPATCHED' }) // Matching UI "Out for Delivery" / DISPATCHED state
        .where(eq(deliveryOrders.id, order.id));

      // 2. Create Assignment (no deliveryPartnerId for internal)
      await innerTx.insert(deliveryAssignments).values({
        tenantId: tenantIdToUse,
        deliveryOrderId: order.id,
        driverName: driver.name,
        vehicleDetails: `${vehicle.plateNumber} - ${vehicle.vehicleType}`,
        status: 'ASSIGNED'
      });
    });

    return NextResponse.json({ success: true, message: 'Dispatched internally successfully' });
  });
}
