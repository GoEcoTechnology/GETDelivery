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

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    if (isNaN(tenantIdToUse)) {
      return NextResponse.json({ error: 'Tenant context is missing or invalid' }, { status: 400 });
    }

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

    if (!['DISPATCHED', 'IN_TRANSIT'].includes(order.status)) {
      return NextResponse.json({ error: `Only DISPATCHED or IN_TRANSIT orders can be completed. Current status: ${order.status}` }, { status: 400 });
    }

    // 1. Update order status to DELIVERED
    await tx
      .update(deliveryOrders)
      .set({ status: 'DELIVERED' })
      .where(eq(deliveryOrders.id, order.id));

    // 2. Update assignment status if exists
    const [assignment] = await tx
      .update(deliveryAssignments)
      .set({ status: 'COMPLETED' })
      .where(eq(deliveryAssignments.deliveryOrderId, order.id))
      .returning();

    // 3. Revert driver and vehicle status if this was an internal assignment
    if (assignment && !assignment.deliveryPartnerId) {
      const driverName = assignment.driverName;
      const vehicleDetails = assignment.vehicleDetails;
      const plateNumber = vehicleDetails.split(' - ')[0];

      await tx.update(drivers)
        .set({ status: 'ACTIVE' })
        .where(and(eq(drivers.tenantId, tenantIdToUse), eq(drivers.name, driverName)));
        
      await tx.update(vehicles)
        .set({ status: 'ACTIVE' })
        .where(and(eq(vehicles.tenantId, tenantIdToUse), eq(vehicles.plateNumber, plateNumber)));
    }

    return NextResponse.json({ success: true, message: 'Delivery completed successfully' });
  });
}
