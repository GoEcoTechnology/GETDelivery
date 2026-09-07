import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, auditLogs, notifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';

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

    // Verify the order is assigned to this partner and is in the IN_TRANSIT state
    const [existingOrder] = await db.select().from(deliveryOrders).where(
      and(
        eq(deliveryOrders.id, orderId),
        eq(deliveryOrders.temporaryWinnerId, partnerId),
        eq(deliveryOrders.status, 'IN_TRANSIT')
      )
    );

    if (!existingOrder) {
      return NextResponse.json({ 
        error: `Could not complete delivery. It must be in OUT FOR DELIVERY state and assigned to you.` 
      }, { status: 400 });
    }

    // Update status to DELIVERED and record completedAt
    const [updatedOrder] = await db
      .update(deliveryOrders)
      .set({
        status: 'DELIVERED',
        completedAt: new Date()
      })
      .where(
        and(
          eq(deliveryOrders.id, orderId),
          eq(deliveryOrders.status, 'IN_TRANSIT'),
          eq(deliveryOrders.temporaryWinnerId, partnerId)
        )
      )
      .returning();

    if (!updatedOrder) {
      return NextResponse.json({ error: 'Failed to complete delivery.' }, { status: 500 });
    }

    // Audit log
    await db.insert(auditLogs).values({
      tenantId: updatedOrder.tenantId,
      actorType: 'PARTNER',
      actorId: partnerId,
      action: 'DELIVERY_COMPLETED',
      entityType: 'DELIVERY_ORDER',
      entityId: orderId,
      details: 'Partner has successfully completed the delivery.'
    });

    // Notify the Business Owner
    const bodyStr = await buildStandardNotificationBody('Delivery Completed', {
      orderId: orderId,
      status: 'DELIVERED',
      reason: 'The Delivery Partner has successfully completed this delivery.'
    });

    await db.insert(notifications).values({
      tenantId: updatedOrder.tenantId,
      deliveryOrderId: orderId,
      senderId: partnerId,
      receiverId: 0, // 0 means broadcast to tenant admins
      receiverRole: 'PLATFORM_OWNER',
      notificationType: 'delivery_completed',
      title: 'Delivery Completed',
      body: bodyStr,
      actionUrl: `/admin/deliveries/${orderId}`,
      status: 'UNREAD'
    });

    return NextResponse.json({ success: true, message: 'Delivery completed successfully.', status: 'DELIVERED' });
  });
}
