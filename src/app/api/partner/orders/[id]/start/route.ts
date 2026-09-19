import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, auditLogs } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['partner.access'] }, async (tx, claims) => {
    const orderId = parseInt((await params).id, 10);
    const partnerId = claims.partnerId as number;

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid delivery order ID' }, { status: 400 });
    }

    // Parse request body for driver details if present
    let driverName = null;
    let driverContact = null;
    try {
      const body = await request.json();
      if (body.driverName) driverName = body.driverName;
      if (body.driverContact) driverContact = body.driverContact;
    } catch (e) {}

    const [existingOrder] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, orderId));
    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    let relatedOrderIds = [orderId];
    if (existingOrder.batchId) {
      const { deliveryBatchItems } = await import('@/db/schema');
      const bItems = await db.select().from(deliveryBatchItems).where(eq(deliveryBatchItems.batchId, existingOrder.batchId));
      if (bItems.length > 0) {
        relatedOrderIds = bItems.map((item: any) => item.customerOrderId);
      }
    }

    // Update status to IN_TRANSIT and record startedAt (this replaces the select and update)
    const updatedOrders = await db
      .update(deliveryOrders)
      .set({
        status: 'IN_TRANSIT',
        startedAt: new Date(),
        ...(driverName && { partnerDriverName: driverName }),
        ...(driverContact && { partnerDriverContact: driverContact })
      })
      .where(
        and(
          inArray(deliveryOrders.id, relatedOrderIds),
          eq(deliveryOrders.temporaryWinnerId, partnerId),
          inArray(deliveryOrders.status, ['ACCEPTED', 'TEMPORARY_WINNER'])
        )
      )
      .returning();

    const updatedOrder = updatedOrders.length > 0 ? updatedOrders[0] : null;

    if (existingOrder.batchId && updatedOrder) {
      const { deliveryBatches } = await import('@/db/schema');
      await db.update(deliveryBatches)
        .set({ status: 'IN_TRANSIT' })
        .where(eq(deliveryBatches.id, existingOrder.batchId));
    }

    if (!updatedOrder) {
      return NextResponse.json({ 
        error: 'Could not start delivery. It must be in ACCEPTED state and assigned to you.' 
      }, { status: 400 });
    }

    // Audit log (fire and forget to speed up response)
    db.insert(auditLogs).values({
      tenantId: updatedOrder.tenantId,
      actorType: 'PARTNER',
      actorId: partnerId,
      action: 'DELIVERY_STARTED',
      entityType: 'DELIVERY_ORDER',
      entityId: orderId,
      details: 'Partner has picked up the order and started the delivery.'
    }).catch(err => console.error('Failed to log audit:', err.message));

    return NextResponse.json({ success: true, message: 'Delivery started successfully.', status: 'IN_TRANSIT' });
  });
}
