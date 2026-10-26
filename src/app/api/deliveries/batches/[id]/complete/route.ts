import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryBatches, deliveryBatchItems, deliveryOrders, deliveryAssignments, drivers, vehicles } from '@/db/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { clearVehicleDeliveryCache } from '@/lib/deliveryCalculation';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.dispatch'] }, async (tx, claims) => {
    const batchId = parseInt((await params).id, 10);

    if (isNaN(batchId)) {
      return NextResponse.json({ error: 'Invalid batch ID' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number | null;

    const [batch] = await tx
      .select()
      .from(deliveryBatches)
      .where(tenantIdToUse ? and(eq(deliveryBatches.id, batchId), eq(deliveryBatches.tenantId, tenantIdToUse)) : eq(deliveryBatches.id, batchId));

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    if (!['DISPATCHED', 'IN_TRANSIT'].includes(batch.status)) {
      return NextResponse.json({
        error: `Only DISPATCHED or IN_TRANSIT own-fleet batches can be completed. Current status: ${batch.status}`
      }, { status: 400 });
    }

    // 1. Fetch all orders belonging to this batch
    const batchItems = await tx
      .select({ customerOrderId: deliveryBatchItems.customerOrderId })
      .from(deliveryBatchItems)
      .where(eq(deliveryBatchItems.batchId, batchId));

    const directOrders = await tx
      .select({ id: deliveryOrders.id })
      .from(deliveryOrders)
      .where(eq(deliveryOrders.batchId, batchId));

    const allOrderIds = Array.from(new Set([
      ...batchItems.map((i: any) => i.customerOrderId).filter(Boolean),
      ...directOrders.map((o: any) => o.id)
    ]));

    // Check if this batch is handled by a partner or broadcasted
    if (allOrderIds.length > 0) {
      const [partnerAssignment] = await tx
        .select({ id: deliveryAssignments.id })
        .from(deliveryAssignments)
        .where(and(
          inArray(deliveryAssignments.deliveryOrderId, allOrderIds),
          isNotNull(deliveryAssignments.deliveryPartnerId)
        ))
        .limit(1);

      const [partnerOrder] = await tx
        .select({ id: deliveryOrders.id })
        .from(deliveryOrders)
        .where(and(
          inArray(deliveryOrders.id, allOrderIds),
          isNotNull(deliveryOrders.temporaryWinnerId)
        ))
        .limit(1);

      if (partnerAssignment || partnerOrder || batch.status === 'ACCEPTED' || batch.status === 'WAITING_FOR_PARTNER') {
        return NextResponse.json({
          error: 'This batch was broadcasted or dispatched to a delivery partner. It must be completed by the delivery partner upon delivery.'
        }, { status: 400 });
      }
    }

    // 2. Mark batch as DELIVERED
    await tx
      .update(deliveryBatches)
      .set({ status: 'DELIVERED' })
      .where(eq(deliveryBatches.id, batchId));

    // 3. Update orders to DELIVERED
    if (allOrderIds.length > 0) {
      await tx
        .update(deliveryOrders)
        .set({ status: 'DELIVERED', completedAt: new Date() })
        .where(inArray(deliveryOrders.id, allOrderIds));

      // 4. Update delivery assignments and release internal drivers & vehicles
      const assignments = await tx
        .update(deliveryAssignments)
        .set({ status: 'COMPLETED' })
        .where(inArray(deliveryAssignments.deliveryOrderId, allOrderIds))
        .returning();

      for (const a of assignments) {
        if (!a.deliveryPartnerId) {
          if (a.driverName) {
            await tx.update(drivers)
              .set({ status: 'ACTIVE' })
              .where(eq(drivers.name, a.driverName));
          }
          if (a.vehicleDetails) {
            const plateNumber = a.vehicleDetails.split(' - ')[0]?.trim();
            if (plateNumber) {
              await tx.update(vehicles)
                .set({ status: 'ACTIVE' })
                .where(eq(vehicles.plateNumber, plateNumber));
            }
          }
        }
      }
    }

    // Also free suggested vehicle if linked
    if (batch.suggestedVehicleId) {
      await tx.update(vehicles)
        .set({ status: 'ACTIVE' })
        .where(eq(vehicles.id, batch.suggestedVehicleId));
    }

    clearVehicleDeliveryCache();

    return NextResponse.json({
      success: true,
      message: 'Batch order completed successfully and fleet resources freed'
    });
  });
}
