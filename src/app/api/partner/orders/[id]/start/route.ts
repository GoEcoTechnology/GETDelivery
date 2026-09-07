import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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

    // Update status to IN_TRANSIT and record startedAt (this replaces the select and update)
    const [updatedOrder] = await db
      .update(deliveryOrders)
      .set({
        status: 'IN_TRANSIT',
        startedAt: new Date(),
        ...(driverName && { partnerDriverName: driverName }),
        ...(driverContact && { partnerDriverContact: driverContact })
      })
      .where(
        and(
          eq(deliveryOrders.id, orderId),
          eq(deliveryOrders.temporaryWinnerId, partnerId),
          inArray(deliveryOrders.status, ['ASSIGNED', 'TEMPORARY_WINNER'])
        )
      )
      .returning();

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
