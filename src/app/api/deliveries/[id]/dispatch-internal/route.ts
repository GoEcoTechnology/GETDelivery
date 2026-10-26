import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryAssignments, drivers, vehicles, users } from '@/db/schema';
import { eq, and, inArray, like } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { deductOrderStock } from '@/lib/inventory-helper';
import { sendDriverAssignmentNotification } from '@/lib/emailWorkflowHelper';
import { clearVehicleDeliveryCache } from '@/lib/deliveryCalculation';
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

    let tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number | null;

    // Validate the order
    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(
        tenantIdToUse
          ? and(eq(deliveryOrders.id, orderId), eq(deliveryOrders.tenantId, tenantIdToUse))
          : eq(deliveryOrders.id, orderId)
      );

    if (!order) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
    }

    const finalTenantId = (tenantIdToUse || order.tenantId) as number;

    if (order.status !== 'READY_FOR_DISPATCH') {
      return NextResponse.json({ error: `Only READY_FOR_DISPATCH orders can be dispatched. Current status: ${order.status}` }, { status: 400 });
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
      return NextResponse.json({ error: 'Valid active driver is required' }, { status: 400 });
    }

    // Check if driver currently has an active delivery
    const activeDriverAssignments = await tx
      .select({ id: deliveryAssignments.id })
      .from(deliveryAssignments)
      .innerJoin(deliveryOrders, eq(deliveryAssignments.deliveryOrderId, deliveryOrders.id))
      .where(and(
        eq(deliveryAssignments.driverName, driver.name),
        inArray(deliveryAssignments.status, ['ASSIGNED', 'IN_TRANSIT']),
        inArray(deliveryOrders.status, ['IN_TRANSIT', 'DISPATCHED', 'ACCEPTED', 'ASSIGNED'])
      ))
      .limit(1);

    if (activeDriverAssignments.length > 0) {
      return NextResponse.json({ error: `Driver ${driver.name} is currently on an active delivery and cannot be assigned.` }, { status: 400 });
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
      return NextResponse.json({ error: 'Valid active vehicle is required' }, { status: 400 });
    }

    // Check if vehicle currently has an active delivery
    const activeVehicleAssignments = await tx
      .select({ id: deliveryAssignments.id })
      .from(deliveryAssignments)
      .innerJoin(deliveryOrders, eq(deliveryAssignments.deliveryOrderId, deliveryOrders.id))
      .where(and(
        like(deliveryAssignments.vehicleDetails, `%${vehicle.plateNumber}%`),
        inArray(deliveryAssignments.status, ['ASSIGNED', 'IN_TRANSIT']),
        inArray(deliveryOrders.status, ['IN_TRANSIT', 'DISPATCHED', 'ACCEPTED', 'ASSIGNED'])
      ))
      .limit(1);

    if (activeVehicleAssignments.length > 0) {
      return NextResponse.json({ error: `Vehicle ${vehicle.plateNumber} is currently on an active delivery and cannot be assigned.` }, { status: 400 });
    }

    const orderWeight = Number(order.totalWeight) || 0;
    if (orderWeight > 0 && vehicle.capacityKg < orderWeight) {
      console.warn(`[Dispatch Warning] Vehicle ${vehicle.plateNumber} (${vehicle.vehicleType}) has insufficient capacity (${vehicle.capacityKg} kg) for order weight (${orderWeight} kg). Proceeding with user override.`);
    }

    try {
      // 0. Deduct Stock (throws if insufficient)
      await deductOrderStock(tx, finalTenantId, order.id, claims.userId as number);

      // 1. Update order status
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
        .where(eq(deliveryOrders.id, order.id));

      // 2. Create Assignment (no deliveryPartnerId for internal)
      await tx.insert(deliveryAssignments).values({
        tenantId: finalTenantId,
        deliveryOrderId: order.id,
        driverName: driver.name,
        vehicleDetails: `${vehicle.plateNumber} - ${vehicle.vehicleType}`,
        status: 'ASSIGNED'
      });

      // 3. Mark driver and vehicle as NOT AVAILABLE
      await tx.update(drivers).set({ status: 'NOT AVAILABLE' }).where(eq(drivers.id, parseInt(driverId)));
      await tx.update(vehicles).set({ status: 'NOT AVAILABLE' }).where(eq(vehicles.id, parseInt(vehicleId)));

      // Send email to assigned driver (fire-and-forget)
      const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/driver/dashboard/${order.id}`;
      sendDriverAssignmentNotification(
        finalTenantId,
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

      clearVehicleDeliveryCache();

      return NextResponse.json({ success: true, message: 'Dispatched internally successfully' });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to dispatch order due to inventory constraints' }, { status: 400 });
    }
  });
}
